import {
  parseAiStructureAnalysis,
  type AiStructureAnalysis,
} from "./structure-analysis";

const geminiAnalysisModel = "gemini-3.1-flash-image";
const geminiAnalysisUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiAnalysisModel}:generateContent`;
const maximumSourceBytes = 20 * 1024 * 1024;
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface GeminiAnalysisResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export interface GeminiAnalysisProvider {
  analyzeImage(input: { source: File }): Promise<AiStructureAnalysis>;
}

export function createGeminiAnalysisProvider(
  apiKey: string,
  fetcher: FetchLike = fetch,
): GeminiAnalysisProvider {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("A Gemini API key is required.");

  return {
    analyzeImage: async ({ source }) => {
      assertSupportedSource(source);
      let response: Response;
      try {
        response = await fetcher(geminiAnalysisUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": normalizedKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: analysisPrompt },
                await toGeminiImageInput(source),
              ],
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: analysisSchema,
            },
          }),
        });
      } catch (cause) {
        throw new Error("Could not reach Gemini for image analysis. Check your connection and try again.", { cause });
      }

      if (!response.ok) {
        throw new Error(geminiAnalysisErrorMessage(response.status));
      }

      let body: GeminiAnalysisResponse;
      try {
        body = await response.json() as GeminiAnalysisResponse;
      } catch (cause) {
        throw new Error("Gemini did not return a usable image analysis.", { cause });
      }
      const text = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .find((part): part is string => Boolean(part));
      if (!text) throw new Error("Gemini did not return a usable image analysis.");

      let result: unknown;
      try {
        result = JSON.parse(text);
      } catch (cause) {
        throw new Error("Gemini did not return valid analysis JSON.", { cause });
      }
      return parseAiStructureAnalysis(normalizeGeminiAnalysis(result));
    },
  };
}

const analysisPrompt = [
  "Analyze the supplied image for a human reviewing raster-to-vector reconstruction.",
  "Describe only visible, high-confidence structure and likely quality problems.",
  "Use normalized integer bounds from 0 to 1000 and concise safe identifiers with lowercase letters, numbers, and hyphens only.",
  "Keep summary and subjectDescription below 280 characters. suggestedColorCount must be 2 through 32.",
  "Use only the enum values defined in the schema. suggestedFill must be a six-digit hex colour or omitted.",
  "Do not claim to create SVG paths or modify the image.",
].join(" ");

const analysisSchema = {
  type: "OBJECT",
  properties: {
    imageKind: { type: "STRING", enum: ["logo", "illustration", "other"] },
    summary: { type: "STRING" },
    subjectDescription: { type: "STRING" },
    majorObjects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          role: { type: "STRING", enum: ["subject", "background", "attached-object", "interior-detail"] },
          bounds: { type: "ARRAY", items: { type: "INTEGER" } },
          confidence: { type: "INTEGER" },
        },
        required: ["id", "label", "role", "bounds", "confidence"],
      },
    },
    suggestedColorCount: { type: "INTEGER" },
    detectedProblems: { type: "ARRAY", items: { type: "STRING" } },
    reconstructionStrategy: { type: "STRING", enum: ["restore", "redraw", "simplify"] },
    regions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          importance: { type: "STRING", enum: ["primary", "supporting", "detail"] },
          bounds: { type: "ARRAY", items: { type: "INTEGER" } },
          suggestedFill: { type: "STRING" },
        },
        required: ["id", "label", "importance", "bounds"],
      },
    },
  },
  required: [
    "imageKind",
    "summary",
    "subjectDescription",
    "majorObjects",
    "suggestedColorCount",
    "detectedProblems",
    "reconstructionStrategy",
    "regions",
  ],
};

function normalizeGeminiAnalysis(value: unknown): unknown {
  if (!isRecord(value)) return value;

  return {
    ...value,
    summary: normalizeText(value.summary, 280),
    subjectDescription: normalizeText(value.subjectDescription, 280),
    suggestedColorCount: clampInteger(value.suggestedColorCount, 2, 32),
    reconstructionStrategy: normalizeStrategy(value.reconstructionStrategy),
    detectedProblems: Array.isArray(value.detectedProblems)
      ? value.detectedProblems.slice(0, 16).map((problem, index) => normalizeId(problem, `problem-${index + 1}`))
      : value.detectedProblems,
    majorObjects: Array.isArray(value.majorObjects)
      ? value.majorObjects.slice(0, 32).map((object, index) => normalizeObject(object, index))
      : value.majorObjects,
    regions: Array.isArray(value.regions)
      ? value.regions.slice(0, 64).map((region, index) => normalizeRegion(region, index))
      : value.regions,
  };
}

function normalizeObject(value: unknown, index: number): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    id: normalizeId(value.id, `object-${index + 1}`),
    label: normalizeText(value.label, 80),
    role: normalizeRole(value.role),
    confidence: clampInteger(value.confidence, 0, 1000),
  };
}

function normalizeRegion(value: unknown, index: number): unknown {
  if (!isRecord(value)) return value;
  const normalized = {
    ...value,
    id: normalizeId(value.id, `region-${index + 1}`),
    label: normalizeText(value.label, 80),
    importance: normalizeImportance(value.importance),
  };
  return /^#[0-9a-fA-F]{6}$/.test(String(value.suggestedFill ?? ""))
    ? normalized
    : Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "suggestedFill"));
}

function normalizeText(value: unknown, maximumLength: number): unknown {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : value;
}

function normalizeId(value: unknown, fallback: string): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!normalized) return fallback;
  return /^[a-z]/.test(normalized) ? normalized : `${fallback}-${normalized}`.slice(0, 64);
}

function normalizeRole(value: unknown): unknown {
  if (value === "structure") return "subject";
  if (value === "text") return "interior-detail";
  return value;
}

function normalizeImportance(value: unknown): unknown {
  if (value === "high") return "primary";
  if (value === "medium") return "supporting";
  if (value === "low") return "detail";
  return value;
}

function normalizeStrategy(value: unknown): unknown {
  if (value === "restore" || value === "redraw" || value === "simplify") return value;
  if (typeof value !== "string") return value;
  const normalized = value.toLowerCase();
  if (normalized.includes("simpl")) return "simplify";
  if (normalized.includes("redraw") || normalized.includes("trace") || normalized.includes("rebuild")) return "redraw";
  return "restore";
}

function clampInteger(value: unknown, minimum: number, maximum: number): unknown {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function toGeminiImageInput(source: File) {
  return {
    inline_data: {
      data: bytesToBase64(new Uint8Array(await source.arrayBuffer())),
      mime_type: source.type,
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  const characters: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    characters.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(characters.join(""));
}

function assertSupportedSource(source: File) {
  if (!supportedImageTypes.has(source.type) || source.size < 1 || source.size > maximumSourceBytes) {
    throw new Error("AI analysis accepts only PNG, JPEG, or WebP images up to 20 MB.");
  }
}

function geminiAnalysisErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Gemini rejected this image analysis request (HTTP 400). Confirm that the image is a valid PNG, JPEG, or WebP and try again.";
    case 401:
      return "Gemini rejected this API key for image analysis (HTTP 401). Save the key again and retry.";
    case 403:
      return "Gemini denied image analysis access (HTTP 403). Check that this key can use Gemini models.";
    case 429:
      return "Gemini image-analysis quota is exhausted (HTTP 429). Check the AI Studio project linked to this key before retrying.";
    default:
      return `Gemini could not analyze this image (HTTP ${status}). Try again shortly.`;
  }
}

import {
  parseAiStructureAnalysis,
  type AiStructureAnalysis,
} from "./structure-analysis";

const geminiAnalysisModel = "gemini-2.5-flash-lite";
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
      return parseAiStructureAnalysis(result);
    },
  };
}

const analysisPrompt = [
  "Analyze the supplied image for a human reviewing raster-to-vector reconstruction.",
  "Describe only visible, high-confidence structure and likely quality problems.",
  "Use normalized integer bounds from 0 to 1000 and concise safe identifiers.",
  "Do not claim to create SVG paths or modify the image.",
].join(" ");

const analysisSchema = {
  type: "OBJECT",
  properties: {
    imageKind: { type: "STRING" },
    summary: { type: "STRING" },
    subjectDescription: { type: "STRING" },
    majorObjects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          role: { type: "STRING" },
          bounds: { type: "ARRAY", items: { type: "INTEGER" } },
          confidence: { type: "INTEGER" },
        },
        required: ["id", "label", "role", "bounds", "confidence"],
      },
    },
    suggestedColorCount: { type: "INTEGER" },
    detectedProblems: { type: "ARRAY", items: { type: "STRING" } },
    reconstructionStrategy: { type: "STRING" },
    regions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          importance: { type: "STRING" },
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

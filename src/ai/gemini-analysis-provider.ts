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
      return parseAiStructureAnalysis(result);
    },
  };
}

const analysisPrompt = [
  "You are an elite reverse-prompt analyst for AI-generated and highly stylized images.",
  "Examine the provided image and reconstruct the most likely original image-generation prompt from visible evidence. The result must help another image model recreate the source with close visual fidelity. Treat this as forensic reconstruction, not creative writing.",
  "Analyze the main subject; action and pose; appearance; foreground, midground, background, and their depth relationships; lighting and atmosphere; composition; visual style; colors and materials; and the likely generation intent.",
  "For posters, magazine covers, and advertisements, describe visible text placement, title hierarchy, subject-to-title overlap, layout blocks, background layers, and overall graphic design. Transcribe visible text exactly when legible; otherwise describe its location, size, color, and typographic style without inventing wording.",
  "Maximize visual fidelity and describe only visually supported details. Do not identify real people, speculate about hidden content, or invent brands, named artists, camera or lens models, render engines, locations, or unseen objects. When uncertain, use broader but still useful wording. Avoid alternatives and filler such as masterpiece, 8k, or highly detailed.",
  "Capture small distinctive details that materially affect recognition. Accurately describe scale, placement, crop, proportions, perspective, orientation, negative space, palette, material finish, texture, transparency, and reflectivity. For simple images, add precision through visible spatial relationships, edges, textures, lighting, palette, and finish rather than inventing content.",
  "If the resolution is too low to verify fine details, state that briefly in analysis and recommend a higher-resolution upload.",
  "Return JSON fields in this exact order: recreationPrompt, corePrompt, negativePrompt, styleTags, analysis, variantOffer.",
  "recreationPrompt must be one concrete, single-line, prompt-ready paragraph of 130 to 220 words, covering subject, pose, appearance, environment, lighting, composition, visual style, palette, materials, aspect ratio, and finish. corePrompt must be a concrete 30 to 60 word reusable prompt covering the most important subject, composition, lighting, style, and palette. negativePrompt must be one compatible line preventing common artifacts and source deviations. styleTags must contain exactly four distinct tags. analysis must contain three to five concise sentences. variantOffer must be one final sentence offering variants.",
  "This is text-only analysis. Never generate, edit, recreate, or transform the image.",
].join(" ");

const analysisSchema = {
  type: "OBJECT",
  properties: {
    recreationPrompt: { type: "STRING" },
    corePrompt: { type: "STRING" },
    negativePrompt: { type: "STRING" },
    styleTags: { type: "ARRAY", items: { type: "STRING" } },
    analysis: { type: "ARRAY", items: { type: "STRING" } },
    variantOffer: { type: "STRING" },
  },
  required: [
    "recreationPrompt",
    "corePrompt",
    "negativePrompt",
    "styleTags",
    "analysis",
    "variantOffer",
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

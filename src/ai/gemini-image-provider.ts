import type {
  AiGeneratedImage,
  ImageReconstructionProvider,
} from "./openai-image-provider";

const geminiImageModel = "gemini-3.1-flash-image";
const geminiGenerateContentUrl = `https://generativelanguage.googleapis.com/v1/models/${geminiImageModel}:generateContent`;
const maximumSourceBytes = 20 * 1024 * 1024;
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const supportedGeneratedImageTypes = new Set(["image/png", "image/jpeg"]);
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface GeminiInlineData {
  data: string;
  mime_type: string;
}

interface GeminiContentPart {
  text?: string;
  inline_data?: GeminiInlineData;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
}

export function createGeminiImageProvider(
  apiKey: string,
  fetcher: FetchLike = fetch,
): ImageReconstructionProvider {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("A Gemini API key is required.");

  return {
    createCleanRedraw: async ({ source }) => {
      assertSupportedSource(source);
      return requestGeminiImage({
        apiKey: normalizedKey,
        fetcher,
        parts: [
          { text: cleanRedrawPrompt },
          await toGeminiImageInput(source),
        ],
      });
    },
    improveImageScale: async ({ source, scale }) => {
      assertSupportedSource(source);
      return requestGeminiImage({
        apiKey: normalizedKey,
        fetcher,
        parts: [
          { text: imageScaleImprovementPrompt(normalizeImageScale(scale)) },
          await toGeminiImageInput(source),
        ],
      });
    },
    createLineArt: async ({ source }) => {
      assertSupportedSource(source);
      return requestGeminiImage({
        apiKey: normalizedKey,
        fetcher,
        parts: [
          { text: lineArtPrompt },
          await toGeminiImageInput(source),
        ],
      });
    },
    colorizeLineArt: async ({ original, lineArt, colorCount }) => {
      assertSupportedSource(original);
      assertSupportedSource(lineArt);
      return requestGeminiImage({
        apiKey: normalizedKey,
        fetcher,
        parts: [
          { text: colorizeLineArtPrompt(normalizeColorCount(colorCount)) },
          await toGeminiImageInput(lineArt),
          await toGeminiImageInput(original),
        ],
      });
    },
    createPromptRedraw: async ({ prompt }) => requestGeminiImage({
      apiKey: normalizedKey,
      fetcher,
      parts: [{ text: promptRedrawPrompt(normalizePrompt(prompt)) }],
    }),
  };
}

const cleanRedrawPrompt = [
  "Create a clean reconstruction of the supplied image for later vectorization.",
  "Preserve the original canvas aspect ratio, composition, subject, silhouette, and distinct objects.",
  "Keep meaningful boundaries and intentional interior details.",
  "Remove compression noise, anti-alias speckles, accidental tiny fragments, and non-semantic texture.",
  "Use clean, flat, closed color regions; do not add, remove, crop, or rearrange content.",
].join(" ");

function imageScaleImprovementPrompt(scale: number) {
  return [
    `Create a ${scale}× higher-resolution version of the supplied image for precise editing and vectorization.`,
    "Preserve the exact composition, aspect ratio, crop, subject, silhouettes, text, colors, and meaningful details.",
    "Improve edge clarity and fine detail without inventing, removing, rearranging, or restyling content.",
    "Return a clean high-definition image at approximately the requested pixel scale.",
  ].join(" ");
}

const lineArtPrompt = [
  "Create solid black line art from the supplied image for later vectorization.",
  "Preserve the original canvas aspect ratio, composition, subject, silhouette, and meaningful interior boundaries.",
  "Use only opaque black lines on a plain white background; do not use color, gray, shading, texture, or gradients.",
  "Do not add, remove, crop, or rearrange content.",
].join(" ");

function colorizeLineArtPrompt(colorCount: number) {
  return [
    "The first image is the black-and-white working image to colorize. The second image is the original color reference.",
    "Color the white regions of the line art using the original image's semantic colors while preserving its composition, silhouette, boundaries, and black linework.",
    `Use exactly ${colorCount} flat fill colors, excluding the preserved black linework and white background.`,
    "Do not add, remove, crop, or rearrange content. Keep the background, black linework, and clean flat color regions suitable for vectorization.",
  ].join(" ");
}

function promptRedrawPrompt(prompt: string) {
  return [
    "Generate one image from this reverse-engineered recreation prompt.",
    "Follow its visible subject, composition, palette, style, and aspect-ratio instructions faithfully.",
    "Do not add a caption, UI, frame, watermark, or explanatory text.",
    "Reverse prompt:",
    prompt,
  ].join(" ");
}

async function requestGeminiImage({
  apiKey,
  fetcher,
  parts,
}: {
  apiKey: string;
  fetcher: FetchLike;
  parts: GeminiContentPart[];
}): Promise<AiGeneratedImage> {
  let response: Response;
  try {
    response = await fetcher(geminiGenerateContentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
  } catch (cause) {
    throw new Error("Could not reach Gemini. Check your connection and try again.", { cause });
  }

  if (!response.ok) {
    throw new Error(geminiImageErrorMessage(response.status));
  }

  let body: GeminiGenerateContentResponse;
  try {
    body = await response.json() as GeminiGenerateContentResponse;
  } catch (cause) {
    throw new Error("Gemini did not return a usable image result.", { cause });
  }

  const generatedImage = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.inlineData)
    .find((image) => image?.mimeType && supportedGeneratedImageTypes.has(image.mimeType));
  const base64 = generatedImage?.data;
  const mimeType = generatedImage?.mimeType;
  if (!base64 || !mimeType || !base64Pattern.test(base64)) {
    throw new Error("Gemini did not return a usable image result.");
  }

  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType: mimeType as AiGeneratedImage["mimeType"],
    model: geminiImageModel,
  };
}

async function toGeminiImageInput(source: File): Promise<GeminiContentPart> {
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

function geminiImageErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Gemini rejected this image request (HTTP 400). Confirm that the image is a valid PNG, JPEG, or WebP and try again.";
    case 401:
      return "Gemini rejected this API key for image generation (HTTP 401). Save the key again and retry.";
    case 403:
      return "Gemini denied image generation access (HTTP 403). Check that this key can use Gemini image models.";
    case 429:
      return "Gemini image-generation quota is exhausted (HTTP 429). Check the AI Studio project linked to this key; if its limit is 0, set up billing before retrying.";
    default:
      return `Gemini could not generate a reconstruction (HTTP ${status}). Try again shortly.`;
  }
}

function assertSupportedSource(source: File) {
  if (!supportedImageTypes.has(source.type) || source.size < 1 || source.size > maximumSourceBytes) {
    throw new Error("AI reconstruction accepts only PNG, JPEG, or WebP images up to 20 MB.");
  }
}

function normalizeColorCount(colorCount: number): number {
  if (!Number.isInteger(colorCount) || colorCount < 2 || colorCount > 32) {
    throw new Error("Line-art colorization supports a color count between 2 and 32.");
  }
  return colorCount;
}

function normalizeImageScale(scale: number): number {
  if (!Number.isInteger(scale) || scale < 2 || scale > 4) {
    throw new Error("AI image scale improvement supports an integer scale between 2× and 4×.");
  }
  return scale;
}

function normalizePrompt(prompt: string): string {
  const normalized = prompt.trim();
  if (!normalized) throw new Error("A reverse prompt is required to generate an image.");
  return normalized;
}

const openAiImageModel = "gpt-image-2";
const maximumSourceBytes = 20 * 1024 * 1024;
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface AiGeneratedImage {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg";
  model: string;
}

export interface CleanRedrawInput {
  source: File;
}

export interface ImageScaleImprovementInput {
  source: File;
  scale: number;
}

export interface LineArtColorizationInput {
  original: File;
  lineArt: File;
  colorCount: number;
}

export interface ImageReconstructionProvider {
  createCleanRedraw(input: CleanRedrawInput): Promise<AiGeneratedImage>;
  improveImageScale(input: ImageScaleImprovementInput): Promise<AiGeneratedImage>;
  createLineArt(input: CleanRedrawInput): Promise<AiGeneratedImage>;
  colorizeLineArt(input: LineArtColorizationInput): Promise<AiGeneratedImage>;
}

interface OpenAiImageEditRequest {
  model: typeof openAiImageModel;
  image: File | File[];
  prompt: string;
  background: "opaque";
  output_format: "png";
  quality: "low";
}

interface OpenAiImageEditResponse {
  data?: Array<{ b64_json?: string }>;
}

export interface OpenAiImageClient {
  images: {
    edit(request: OpenAiImageEditRequest): Promise<OpenAiImageEditResponse>;
  };
}

export function createImageFileFromGeneratedImage(
  image: AiGeneratedImage,
  filename: string,
): File {
  const match = new RegExp(
    `^data:${image.mimeType};base64,([A-Za-z0-9+/]*={0,2})$`,
  ).exec(image.dataUrl);
  const base64 = match?.[1];
  if (!base64 || !base64Pattern.test(base64)) {
    throw new Error("The generated image does not contain usable image data.");
  }

  const decoded = atob(base64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: image.mimeType });
}

export function createPngFileFromGeneratedImage(
  image: AiGeneratedImage,
  filename: string,
): File {
  if (image.mimeType !== "image/png") {
    throw new Error("The generated image does not contain a usable PNG.");
  }
  try {
    return createImageFileFromGeneratedImage(image, filename);
  } catch (cause) {
    throw new Error("The generated image does not contain a usable PNG.", { cause });
  }
}

export async function createOpenAiImageProvider(apiKey: string): Promise<ImageReconstructionProvider> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("An OpenAI API key is required.");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: normalizedKey,
    dangerouslyAllowBrowser: true,
  });

  return createOpenAiImageProviderWithClient(client);
}

export function createOpenAiImageProviderWithClient(
  client: OpenAiImageClient,
): ImageReconstructionProvider {
  return {
    createCleanRedraw: async ({ source }) => {
      assertSupportedSource(source);
      return requestImageEdit(client, {
        image: source,
        prompt: cleanRedrawPrompt,
      });
    },
    improveImageScale: async ({ source, scale }) => {
      assertSupportedSource(source);
      return requestImageEdit(client, {
        image: source,
        prompt: imageScaleImprovementPrompt(normalizeImageScale(scale)),
      });
    },
    createLineArt: async ({ source }) => {
      assertSupportedSource(source);
      return requestImageEdit(client, {
        image: source,
        prompt: lineArtPrompt,
      });
    },
    colorizeLineArt: async ({ original, lineArt, colorCount }) => {
      assertSupportedSource(original);
      assertSupportedSource(lineArt);
      return requestImageEdit(client, {
        image: [lineArt, original],
        prompt: colorizeLineArtPrompt(normalizeColorCount(colorCount)),
      });
    },
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

async function requestImageEdit(
  client: OpenAiImageClient,
  request: Pick<OpenAiImageEditRequest, "image" | "prompt">,
): Promise<AiGeneratedImage> {
  let response: OpenAiImageEditResponse;
  try {
    response = await client.images.edit({
      ...request,
      model: openAiImageModel,
      background: "opaque",
      output_format: "png",
      quality: "low",
    });
  } catch (cause) {
    throw new Error(openAiImageErrorMessage(readHttpStatus(cause)), { cause });
  }

  const base64 = response.data?.[0]?.b64_json;
  if (!base64 || !base64Pattern.test(base64)) {
    throw new Error("OpenAI did not return a usable PNG image.");
  }

  return {
    dataUrl: `data:image/png;base64,${base64}`,
    mimeType: "image/png",
    model: openAiImageModel,
  };
}

function readHttpStatus(cause: unknown): number | undefined {
  if (!cause || typeof cause !== "object") return undefined;
  const status = (cause as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

function openAiImageErrorMessage(status: number | undefined): string {
  switch (status) {
    case 400:
      return "OpenAI rejected this image request (HTTP 400). Confirm that the image is a valid PNG, JPEG, or WebP and try again.";
    case 401:
      return "OpenAI rejected this API key for image generation (HTTP 401). Save the key again and retry.";
    case 403:
      return "OpenAI denied GPT Image access (HTTP 403). Complete organization verification in the OpenAI developer console, then retry.";
    case 429:
      return "OpenAI is rate-limiting image generation (HTTP 429). Wait a moment, then retry.";
    default:
      return "OpenAI could not generate a reconstruction. Check your connection and account access.";
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

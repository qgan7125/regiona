const openAiImageModel = "gpt-image-2";
const maximumSourceBytes = 20 * 1024 * 1024;
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface AiGeneratedImage {
  dataUrl: string;
  mimeType: "image/png";
  model: typeof openAiImageModel;
}

export interface CleanRedrawInput {
  source: File;
}

export interface ColorReconstructionInput {
  original: File;
  cleanRedraw: File;
  palette?: readonly string[];
}

export interface ImageReconstructionProvider {
  createCleanRedraw(input: CleanRedrawInput): Promise<AiGeneratedImage>;
  reconstructColors(input: ColorReconstructionInput): Promise<AiGeneratedImage>;
}

interface OpenAiImageEditRequest {
  model: typeof openAiImageModel;
  image: File | File[];
  prompt: string;
  background: "opaque";
  input_fidelity: "high";
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

export function createPngFileFromGeneratedImage(
  image: AiGeneratedImage,
  filename: string,
): File {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/.exec(image.dataUrl);
  const base64 = match?.[1];
  if (!base64 || !base64Pattern.test(base64)) {
    throw new Error("The generated image does not contain a usable PNG.");
  }

  const decoded = atob(base64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  return new File([bytes], filename, { type: image.mimeType });
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
    reconstructColors: async ({ original, cleanRedraw, palette }) => {
      assertSupportedSource(original);
      assertSupportedSource(cleanRedraw);
      return requestImageEdit(client, {
        image: [cleanRedraw, original],
        prompt: colorReconstructionPrompt(normalizePalette(palette)),
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

function colorReconstructionPrompt(palette: readonly string[]) {
  const paletteInstruction = palette.length
    ? `Use this target palette where it fits the original semantics: ${palette.join(", ")}.`
    : "Use the original image as the color reference.";

  return [
    "The first image is the clean geometry reference. The second image is the original color reference.",
    "Apply the original semantic colors to the clean geometry while preserving its composition, silhouette, and boundaries.",
    paletteInstruction,
    "Do not add, remove, crop, or rearrange content. Keep clean, flat color regions suitable for vectorization.",
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
      input_fidelity: "high",
      output_format: "png",
      quality: "low",
    });
  } catch {
    throw new Error("OpenAI could not generate a reconstruction. Check your API key, connection, and account access.");
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

function assertSupportedSource(source: File) {
  if (!supportedImageTypes.has(source.type) || source.size < 1 || source.size > maximumSourceBytes) {
    throw new Error("AI reconstruction accepts only PNG, JPEG, or WebP images up to 20 MB.");
  }
}

function normalizePalette(palette: readonly string[] | undefined): string[] {
  if (!palette?.length) return [];
  if (palette.length > 32) throw new Error("AI reconstruction supports at most 32 target palette colors.");

  const normalized = palette.map((color) => color.trim().toLowerCase());
  if (normalized.some((color) => !hexColorPattern.test(color))) {
    throw new Error("Target palette colors must be six-digit hex values.");
  }

  return [...new Set(normalized)];
}

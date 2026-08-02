import type { AiGeneratedImage } from "./openai-image-provider";

const MAX_UPSCALED_PIXELS = 16 * 1024 * 1024;
const supportedScales = new Set([2, 3, 4]);

export interface UpscaleDimensions {
  width: number;
  height: number;
  requestedScale: number;
  appliedScale: number;
  wasLimited: boolean;
}

export function calculateUpscaleDimensions({
  width,
  height,
  scale,
}: {
  width: number;
  height: number;
  scale: number;
}): UpscaleDimensions {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("AI upscale requires positive source dimensions.");
  }
  if (!supportedScales.has(scale)) {
    throw new Error("AI image scale improvement supports an integer scale between 2× and 4×.");
  }

  const requestedWidth = width * scale;
  const requestedHeight = height * scale;
  const pixelLimitScale = Math.min(1, Math.sqrt(MAX_UPSCALED_PIXELS / (requestedWidth * requestedHeight)));
  const targetWidth = Math.max(1, Math.floor(requestedWidth * pixelLimitScale));
  const targetHeight = Math.max(1, Math.floor(requestedHeight * pixelLimitScale));
  const wasLimited = targetWidth !== requestedWidth || targetHeight !== requestedHeight;

  return {
    width: targetWidth,
    height: targetHeight,
    requestedScale: scale,
    appliedScale: Math.min(targetWidth / width, targetHeight / height),
    wasLimited,
  };
}

export async function resizeAiGeneratedImage(
  image: AiGeneratedImage,
  dimensions: Pick<UpscaleDimensions, "width" | "height">,
): Promise<AiGeneratedImage> {
  const sourceBlob = await (await fetch(image.dataUrl)).blob();
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    if (bitmap.width === dimensions.width && bitmap.height === dimensions.height) return image;

    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("AI upscale could not allocate an image canvas.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    const outputBlob = await canvasToPng(canvas);
    return {
      ...image,
      dataUrl: await blobToDataUrl(outputBlob),
      mimeType: "image/png",
    };
  } finally {
    bitmap.close();
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("AI upscale could not encode a PNG image."));
    }, "image/png");
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("AI upscale could not read the final image."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("AI upscale could not read the final image."));
    };
    reader.readAsDataURL(blob);
  });
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const MAX_PIXEL_COUNT = 2048 * 2048;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface DecodedImage {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

function hasSupportedSignature(bytes: Uint8Array) {
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return isPng || isJpeg || isWebp;
}

export async function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    throw new Error("Images must be between 1 byte and 20 MB.");
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasSupportedSignature(header)) {
    throw new Error("The file contents do not match a supported image format.");
  }
}

export async function decodeImage(file: File): Promise<DecodedImage> {
  await validateImageFile(file);
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(MAX_PIXEL_COUNT / (bitmap.width * bitmap.height)),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
    });
    if (!context) throw new Error("Canvas image decoding is unavailable.");

    context.drawImage(bitmap, 0, 0, width, height);
    return {
      pixels: context.getImageData(0, 0, width, height).data,
      width,
      height,
      originalWidth: bitmap.width,
      originalHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

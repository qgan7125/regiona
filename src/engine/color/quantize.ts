import type { PaletteColor } from "../../types/project";

interface HistogramColor {
  key: number;
  count: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ColorBox {
  colors: HistogramColor[];
}

export interface QuantizeResult {
  palette: PaletteColor[];
  paletteIndexes: Uint8Array;
}

const clampTarget = (targetColors: number) =>
  Math.max(2, Math.min(64, Math.round(targetColors)));

const toHex = (value: number) => value.toString(16).padStart(2, "0");

const rgbaToHex = (rgba: readonly number[]) =>
  `#${toHex(rgba[0] ?? 0)}${toHex(rgba[1] ?? 0)}${toHex(rgba[2] ?? 0)}`;

function buildHistogram(pixels: Uint8ClampedArray): HistogramColor[] {
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number; a: number }
  >();

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index] ?? 0;
    const g = pixels[index + 1] ?? 0;
    const b = pixels[index + 2] ?? 0;
    const a = pixels[index + 3] ?? 255;
    const key =
      ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | (a >> 3);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.a += a;
    } else {
      buckets.set(key, { count: 1, r, g, b, a });
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([key, bucket]) => ({
      key,
      count: bucket.count,
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
      a: Math.round(bucket.a / bucket.count),
    }));
}

function channelRange(colors: HistogramColor[], channel: "r" | "g" | "b" | "a") {
  let minimum = 255;
  let maximum = 0;

  for (const color of colors) {
    minimum = Math.min(minimum, color[channel]);
    maximum = Math.max(maximum, color[channel]);
  }

  return maximum - minimum;
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] | undefined {
  if (box.colors.length < 2) return undefined;

  const channels = ["r", "g", "b", "a"] as const;
  const channel = channels.reduce((widest, candidate) =>
    channelRange(box.colors, candidate) > channelRange(box.colors, widest)
      ? candidate
      : widest,
  );
  const sorted = [...box.colors].sort(
    (left, right) => left[channel] - right[channel] || left.key - right.key,
  );
  const total = sorted.reduce((sum, color) => sum + color.count, 0);
  let running = 0;
  let splitIndex = 1;

  for (let index = 0; index < sorted.length - 1; index += 1) {
    running += sorted[index]?.count ?? 0;
    if (running >= total / 2) {
      splitIndex = index + 1;
      break;
    }
  }

  return [
    { colors: sorted.slice(0, splitIndex) },
    { colors: sorted.slice(splitIndex) },
  ];
}

function averageBox(box: ColorBox): [number, number, number, number] {
  const total = box.colors.reduce((sum, color) => sum + color.count, 0);
  const sum: [number, number, number, number] = [0, 0, 0, 0];

  for (const color of box.colors) {
    sum[0] += color.r * color.count;
    sum[1] += color.g * color.count;
    sum[2] += color.b * color.count;
    sum[3] += color.a * color.count;
  }

  return sum.map((value) => Math.round(value / total)) as [
    number,
    number,
    number,
    number,
  ];
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  a: number,
  candidate: readonly number[],
) {
  const red = r - (candidate[0] ?? 0);
  const green = g - (candidate[1] ?? 0);
  const blue = b - (candidate[2] ?? 0);
  const alpha = a - (candidate[3] ?? 255);
  return red * red + green * green + blue * blue + alpha * alpha * 2;
}

export function quantizeImage(
  pixels: Uint8ClampedArray,
  requestedColors: number,
): QuantizeResult {
  if (pixels.length === 0 || pixels.length % 4 !== 0) {
    throw new Error("Pixel data must contain complete RGBA pixels.");
  }

  const targetColors = clampTarget(requestedColors);
  const histogram = buildHistogram(pixels);
  const boxes: ColorBox[] = [{ colors: histogram }];

  while (boxes.length < targetColors) {
    const candidates = boxes
      .map((box, index) => ({
        box,
        index,
        score:
          Math.max(
            channelRange(box.colors, "r"),
            channelRange(box.colors, "g"),
            channelRange(box.colors, "b"),
            channelRange(box.colors, "a"),
          ) * box.colors.reduce((sum, color) => sum + color.count, 0),
      }))
      .filter(({ box }) => box.colors.length > 1)
      .sort((left, right) => right.score - left.score || left.index - right.index);
    const candidate = candidates[0];

    if (!candidate) break;
    const split = splitBox(candidate.box);
    if (!split) break;
    boxes.splice(candidate.index, 1, ...split);
  }

  const rgbaPalette = boxes.map(averageBox);
  const paletteIndexes = new Uint8Array(pixels.length / 4);
  const counts = new Uint32Array(rgbaPalette.length);

  for (let pixelIndex = 0; pixelIndex < paletteIndexes.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const a = pixels[offset + 3] ?? 255;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let paletteIndex = 0; paletteIndex < rgbaPalette.length; paletteIndex += 1) {
      const distance = colorDistance(
        r,
        g,
        b,
        a,
        rgbaPalette[paletteIndex] ?? [0, 0, 0, 255],
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = paletteIndex;
      }
    }

    paletteIndexes[pixelIndex] = nearestIndex;
    counts[nearestIndex] = (counts[nearestIndex] ?? 0) + 1;
  }

  const palette = rgbaPalette.map((rgba, index): PaletteColor => ({
    id: `color-${index.toString().padStart(3, "0")}`,
    index,
    hex: rgbaToHex(rgba),
    rgba,
    pixelCount: counts[index] ?? 0,
    percentage: (counts[index] ?? 0) / paletteIndexes.length,
  }));

  return { palette, paletteIndexes };
}

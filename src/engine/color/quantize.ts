import type { PaletteColor } from "../../types/project";

interface HistogramColor {
  key: number;
  count: number;
  r: number;
  g: number;
  b: number;
  a: number;
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

type Rgba = [number, number, number, number];

function nearestPaletteIndex(color: HistogramColor, palette: Rgba[]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < palette.length; index += 1) {
    const distance = colorDistance(color.r, color.g, color.b, color.a, palette[index] ?? [0, 0, 0, 255]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function chooseSeeds(histogram: HistogramColor[], targetColors: number): Rgba[] {
  const remaining = [...histogram].sort(
    (left, right) => right.count - left.count || left.key - right.key,
  );
  const first = remaining.shift();
  if (!first) return [];

  const seeds: Rgba[] = [[first.r, first.g, first.b, first.a]];
  while (seeds.length < targetColors && remaining.length) {
    const candidateIndex = remaining.reduce((bestIndex, color, index) => {
      const nearestDistance = Math.min(
        ...seeds.map((seed) => colorDistance(color.r, color.g, color.b, color.a, seed)),
      );
      const best = remaining[bestIndex];
      const bestDistance = best
        ? Math.min(
            ...seeds.map((seed) => colorDistance(best.r, best.g, best.b, best.a, seed)),
          )
        : -1;
      const score = color.count * nearestDistance;
      const bestScore = (best?.count ?? 0) * bestDistance;
      return score > bestScore || (score === bestScore && color.key < (best?.key ?? Infinity))
        ? index
        : bestIndex;
    }, 0);
    const [candidate] = remaining.splice(candidateIndex, 1);
    if (candidate) seeds.push([candidate.r, candidate.g, candidate.b, candidate.a]);
  }

  return seeds;
}

function clusterHistogram(histogram: HistogramColor[], seeds: Rgba[]): Rgba[] {
  let palette = seeds;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = palette.map(() => ({ count: 0, r: 0, g: 0, b: 0, a: 0 }));
    for (const color of histogram) {
      const cluster = sums[nearestPaletteIndex(color, palette)];
      if (!cluster) continue;
      cluster.count += color.count;
      cluster.r += color.r * color.count;
      cluster.g += color.g * color.count;
      cluster.b += color.b * color.count;
      cluster.a += color.a * color.count;
    }

    const nextPalette = sums
      .map((sum): Rgba | undefined => {
        if (!sum.count) return undefined;
        return [
          Math.round(sum.r / sum.count),
          Math.round(sum.g / sum.count),
          Math.round(sum.b / sum.count),
          Math.round(sum.a / sum.count),
        ];
      })
      .filter((color): color is Rgba => Boolean(color));

    if (nextPalette.length === palette.length && nextPalette.every(
      (color, index) => color.every((channel, channelIndex) => channel === palette[index]?.[channelIndex]),
    )) {
      return nextPalette;
    }
    palette = nextPalette;
  }

  return palette;
}

function mapPixelsToPalette(pixels: Uint8ClampedArray, palette: Rgba[]) {
  const paletteIndexes = new Uint8Array(pixels.length / 4);
  const counts = new Uint32Array(palette.length);

  for (let pixelIndex = 0; pixelIndex < paletteIndexes.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const nearestIndex = nearestPaletteIndex(
      {
        key: pixelIndex,
        count: 1,
        r: pixels[offset] ?? 0,
        g: pixels[offset + 1] ?? 0,
        b: pixels[offset + 2] ?? 0,
        a: pixels[offset + 3] ?? 255,
      },
      palette,
    );
    paletteIndexes[pixelIndex] = nearestIndex;
    counts[nearestIndex] = (counts[nearestIndex] ?? 0) + 1;
  }

  return { paletteIndexes, counts };
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
  const seeds = chooseSeeds(histogram, Math.min(targetColors, histogram.length));
  let rgbaPalette = clusterHistogram(histogram, seeds);
  let { paletteIndexes, counts } = mapPixelsToPalette(pixels, rgbaPalette);

  const populatedPalette = rgbaPalette.filter((_, index) => (counts[index] ?? 0) > 0);
  if (populatedPalette.length !== rgbaPalette.length) {
    rgbaPalette = populatedPalette;
    ({ paletteIndexes, counts } = mapPixelsToPalette(pixels, rgbaPalette));
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

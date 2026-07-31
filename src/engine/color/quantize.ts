import type { PaletteColor } from "../../types/project";
import { oklabToRgb, rgbToOklab } from "./oklab";

interface HistogramColor {
  key: number;
  count: number;
  r: number;
  g: number;
  b: number;
  a: number;
  okL: number;
  okA: number;
  okB: number;
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
    .map(([key, bucket]): HistogramColor => {
      const r = Math.round(bucket.r / bucket.count);
      const g = Math.round(bucket.g / bucket.count);
      const b = Math.round(bucket.b / bucket.count);
      const oklab = rgbToOklab(r, g, b);
      return {
        key,
        count: bucket.count,
        r,
        g,
        b,
        a: Math.round(bucket.a / bucket.count),
        okL: oklab.l,
        okA: oklab.a,
        okB: oklab.b,
      };
    });
}

// Perceptual OKLab distance for the color channels, plus a normalized alpha term (alpha
// isn't part of OKLab, so it's folded in separately on a comparable 0-1 scale) so fully
// transparent and opaque pixels never get quantized into the same palette entry.
function colorDistance(
  color: { okL: number; okA: number; okB: number; a: number },
  candidate: { okL: number; okA: number; okB: number; a: number },
) {
  const dl = color.okL - candidate.okL;
  const da = color.okA - candidate.okA;
  const db = color.okB - candidate.okB;
  const dAlpha = (color.a - candidate.a) / 255;
  return dl * dl + da * da + db * db + dAlpha * dAlpha;
}

interface PaletteCenter {
  okL: number;
  okA: number;
  okB: number;
  a: number;
}

const HUE_FAMILY_COUNT = 12;
const NEUTRAL_CHROMA_THRESHOLD = 0.04;

function colorFamily(color: Pick<HistogramColor, "okL" | "okA" | "okB">) {
  const chroma = Math.hypot(color.okA, color.okB);
  if (chroma < NEUTRAL_CHROMA_THRESHOLD) {
    // Neutrals have no meaningful hue, but a dark outline and a light background are still
    // distinct visual roles. Keeping their lightness bands separate prevents either from
    // being consumed by a nearby chromatic color during the diversity pass.
    return `neutral-${Math.min(2, Math.floor(color.okL * 3))}`;
  }

  const hue = (Math.atan2(color.okB, color.okA) + Math.PI * 2) % (Math.PI * 2);
  return `hue-${Math.floor(hue / ((Math.PI * 2) / HUE_FAMILY_COUNT))}`;
}

function nearestPaletteIndex(color: HistogramColor, palette: PaletteCenter[]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < palette.length; index += 1) {
    const distance = colorDistance(color, palette[index] ?? { okL: 0, okA: 0, okB: 0, a: 255 });
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

function chooseSeeds(histogram: HistogramColor[], targetColors: number): PaletteCenter[] {
  const remaining = [...histogram].sort(
    (left, right) => right.count - left.count || left.key - right.key,
  );
  const first = remaining.shift();
  if (!first) return [];

  const seeds: PaletteCenter[] = [{ okL: first.okL, okA: first.okA, okB: first.okB, a: first.a }];
  const chosenFamilies = new Set([colorFamily(first)]);
  while (seeds.length < targetColors && remaining.length) {
    // Select one representative per broad color family before allowing a dominant gradient
    // to claim more than one slot. The second pass below still uses perceptual distance, so
    // a high color budget can retain tonal variation once the key hues and neutral roles are
    // covered.
    const hasUnrepresentedFamily = remaining.some((color) => !chosenFamilies.has(colorFamily(color)));
    const candidates = hasUnrepresentedFamily
      ? remaining.filter((color) => !chosenFamilies.has(colorFamily(color)))
      : remaining;
    const candidate = candidates.reduce((best, color) => {
      const nearestDistance = Math.min(
        ...seeds.map((seed) => colorDistance(color, seed)),
      );
      const bestDistance = best
        ? Math.min(...seeds.map((seed) => colorDistance(best, seed)))
        : -1;
      // A linear pixel-count weight lets a large, smooth gradient spend several palette
      // entries on nearly the same hue before a smaller but visibly distinct region gets
      // represented. Square root weighting still favors substantial areas, but gives a
      // perceptually distant accent color a realistic chance to claim one of the limited
      // palette slots.
      const score = Math.sqrt(color.count) * nearestDistance;
      const bestScore = Math.sqrt(best?.count ?? 0) * bestDistance;
      return score > bestScore || (score === bestScore && color.key < (best?.key ?? Infinity))
        ? color
        : best;
    }, undefined as HistogramColor | undefined);
    const candidateIndex = candidate ? remaining.indexOf(candidate) : -1;
    const [selected] = candidateIndex >= 0 ? remaining.splice(candidateIndex, 1) : [];
    if (selected) {
      seeds.push({ okL: selected.okL, okA: selected.okA, okB: selected.okB, a: selected.a });
      chosenFamilies.add(colorFamily(selected));
    }
  }

  return seeds;
}

function clusterHistogram(histogram: HistogramColor[], seeds: PaletteCenter[]): PaletteCenter[] {
  let palette = seeds;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = palette.map(() => ({ count: 0, okL: 0, okA: 0, okB: 0, a: 0 }));
    for (const color of histogram) {
      const cluster = sums[nearestPaletteIndex(color, palette)];
      if (!cluster) continue;
      cluster.count += color.count;
      cluster.okL += color.okL * color.count;
      cluster.okA += color.okA * color.count;
      cluster.okB += color.okB * color.count;
      cluster.a += color.a * color.count;
    }

    const nextPalette = sums
      .map((sum): PaletteCenter | undefined => {
        if (!sum.count) return undefined;
        return {
          okL: sum.okL / sum.count,
          okA: sum.okA / sum.count,
          okB: sum.okB / sum.count,
          a: sum.a / sum.count,
        };
      })
      .filter((color): color is PaletteCenter => Boolean(color));

    if (nextPalette.length === palette.length && nextPalette.every(
      (color, index) => {
        const previous = palette[index];
        return previous
          && color.okL === previous.okL
          && color.okA === previous.okA
          && color.okB === previous.okB
          && color.a === previous.a;
      },
    )) {
      return nextPalette;
    }
    palette = nextPalette;
  }

  return palette;
}

function mapPixelsToPalette(pixels: Uint8ClampedArray, palette: PaletteCenter[]) {
  const paletteIndexes = new Uint8Array(pixels.length / 4);
  const counts = new Uint32Array(palette.length);
  // Real photos repeat exact RGB values constantly (flat skies, backgrounds, gradients
  // banding to the same 8-bit steps), so caching the OKLab conversion by packed RGB pays
  // for itself well before the palette is exhausted; it stays a rare miss for adversarial
  // pure-noise input, which is not representative of real usage anyway.
  const oklabCache = new Map<number, { okL: number; okA: number; okB: number }>();

  for (let pixelIndex = 0; pixelIndex < paletteIndexes.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const rgbKey = (r << 16) | (g << 8) | b;
    let oklab = oklabCache.get(rgbKey);
    if (!oklab) {
      const converted = rgbToOklab(r, g, b);
      oklab = { okL: converted.l, okA: converted.a, okB: converted.b };
      oklabCache.set(rgbKey, oklab);
    }
    const nearestIndex = nearestPaletteIndex(
      {
        key: pixelIndex,
        count: 1,
        r,
        g,
        b,
        a: pixels[offset + 3] ?? 255,
        okL: oklab.okL,
        okA: oklab.okA,
        okB: oklab.okB,
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
  let centers = clusterHistogram(histogram, seeds);
  let { paletteIndexes, counts } = mapPixelsToPalette(pixels, centers);

  const populatedCenters = centers.filter((_, index) => (counts[index] ?? 0) > 0);
  if (populatedCenters.length !== centers.length) {
    centers = populatedCenters;
    ({ paletteIndexes, counts } = mapPixelsToPalette(pixels, centers));
  }

  const palette = centers.map((center, index): PaletteColor => {
    const [r, g, b] = oklabToRgb({ l: center.okL, a: center.okA, b: center.okB });
    const rgba: [number, number, number, number] = [r, g, b, Math.round(center.a)];
    return {
      id: `color-${index.toString().padStart(3, "0")}`,
      index,
      hex: rgbaToHex(rgba),
      rgba,
      pixelCount: counts[index] ?? 0,
      percentage: (counts[index] ?? 0) / paletteIndexes.length,
    };
  });

  return { palette, paletteIndexes };
}

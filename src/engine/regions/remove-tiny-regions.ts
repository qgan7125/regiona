import { oklabDistanceSquared, rgbToOklab } from "../color/oklab";

interface ComponentMap {
  labels: Uint32Array;
  areas: number[];
  paletteIndexes: number[];
}

interface NeighborScore {
  sharedEdgeCount: number;
  sourceEdgeDifference: number;
}

const DEFAULT_MAXIMUM_PASSES = 3;
// OKLab distance beyond which two colors count as a "strong" original-image edge worth
// protecting. OKLab distances run roughly: under 0.05 is imperceptible, ~0.1 is a subtle
// but visible step, above 0.3 is a clearly distinct color - 0.2 sits comfortably between
// gentle gradient/noise steps and genuine color or luminance boundaries.
export const SOURCE_EDGE_THRESHOLD = 0.2;
export const SOURCE_EDGE_THRESHOLD_SQUARED = SOURCE_EDGE_THRESHOLD * SOURCE_EDGE_THRESHOLD;

export function sourceEdgeDifference(
  pixels: Uint8ClampedArray | undefined,
  index: number,
  neighbor: number,
) {
  if (!pixels) return 0;

  const offset = index * 4;
  const neighborOffset = neighbor * 4;
  const color = rgbToOklab(pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0);
  const neighborColor = rgbToOklab(
    pixels[neighborOffset] ?? 0,
    pixels[neighborOffset + 1] ?? 0,
    pixels[neighborOffset + 2] ?? 0,
  );

  return oklabDistanceSquared(color, neighborColor);
}

function mapComponents(
  paletteIndexes: Uint8Array,
  width: number,
  height: number,
): ComponentMap {
  const labels = new Uint32Array(paletteIndexes.length);
  const stack = new Uint32Array(paletteIndexes.length);
  const areas: number[] = [];
  const componentPaletteIndexes: number[] = [];

  for (let start = 0; start < paletteIndexes.length; start += 1) {
    if (labels[start]) continue;

    const componentNumber = areas.length + 1;
    const paletteIndex = paletteIndexes[start] ?? 0;
    let stackLength = 0;
    let area = 0;
    stack[stackLength] = start;
    stackLength += 1;
    labels[start] = componentNumber;

    while (stackLength) {
      stackLength -= 1;
      const index = stack[stackLength] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0
          && !labels[neighbor]
          && paletteIndexes[neighbor] === paletteIndex
        ) {
          labels[neighbor] = componentNumber;
          stack[stackLength] = neighbor;
          stackLength += 1;
        }
      }
    }

    areas.push(area);
    componentPaletteIndexes.push(paletteIndex);
  }

  return { labels, areas, paletteIndexes: componentPaletteIndexes };
}

export function removeTinyPaletteRegions(
  paletteIndexes: Uint8Array,
  width: number,
  height: number,
  maximumArea: number,
  sourcePixels?: Uint8ClampedArray,
  maximumPasses = DEFAULT_MAXIMUM_PASSES,
) {
  const threshold = Math.max(0, Math.floor(maximumArea));
  if (!threshold || paletteIndexes.length !== width * height) {
    return new Uint8Array(paletteIndexes);
  }

  const usableSourcePixels = sourcePixels?.length === paletteIndexes.length * 4
    ? sourcePixels
    : undefined;
  const maximumIterations = Math.max(1, Math.floor(maximumPasses));
  let cleaned = new Uint8Array(paletteIndexes);

  for (let pass = 0; pass < maximumIterations; pass += 1) {
    const components = mapComponents(cleaned, width, height);
    const neighborScores: Array<Map<number, NeighborScore> | undefined> = [];

    for (let index = 0; index < cleaned.length; index += 1) {
      const componentIndex = (components.labels[index] ?? 0) - 1;
      if ((components.areas[componentIndex] ?? 0) > threshold) continue;

      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0) continue;
        const neighborComponentIndex = (components.labels[neighbor] ?? 0) - 1;
        if (neighborComponentIndex === componentIndex) continue;
        const scores = neighborScores[componentIndex] ?? new Map<number, NeighborScore>();
        const score = scores.get(neighborComponentIndex) ?? {
          sharedEdgeCount: 0,
          sourceEdgeDifference: 0,
        };
        score.sharedEdgeCount += 1;
        score.sourceEdgeDifference += sourceEdgeDifference(usableSourcePixels, index, neighbor);
        scores.set(neighborComponentIndex, score);
        neighborScores[componentIndex] = scores;
      }
    }

    const replacements = new Uint8Array(components.areas.length);
    for (let componentIndex = 0; componentIndex < components.areas.length; componentIndex += 1) {
      if ((components.areas[componentIndex] ?? 0) > threshold) continue;
      const neighbors = neighborScores[componentIndex];
      if (!neighbors?.size) continue;

      let replacementComponent = -1;
      let sharedEdgeCount = -1;
      for (const [neighborComponent, score] of neighbors) {
        const averageSourceEdge = score.sourceEdgeDifference / score.sharedEdgeCount;
        if (usableSourcePixels && averageSourceEdge > SOURCE_EDGE_THRESHOLD_SQUARED) continue;

        const candidatePalette = components.paletteIndexes[neighborComponent] ?? 0;
        const currentPalette = components.paletteIndexes[replacementComponent] ?? Number.MAX_SAFE_INTEGER;
        if (
          score.sharedEdgeCount > sharedEdgeCount
          || (score.sharedEdgeCount === sharedEdgeCount && candidatePalette < currentPalette)
        ) {
          replacementComponent = neighborComponent;
          sharedEdgeCount = score.sharedEdgeCount;
        }
      }
      if (replacementComponent >= 0) {
        replacements[componentIndex] = (components.paletteIndexes[replacementComponent] ?? 0) + 1;
      }
    }

    let changed = false;
    const next = new Uint8Array(cleaned);
    for (let index = 0; index < next.length; index += 1) {
      const replacement = replacements[(components.labels[index] ?? 0) - 1] ?? 0;
      if (!replacement) continue;
      next[index] = replacement - 1;
      changed = true;
    }
    cleaned = next;
    if (!changed) break;
  }

  return cleaned;
}

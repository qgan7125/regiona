import { SOURCE_EDGE_THRESHOLD_SQUARED, sourceEdgeDifference } from "./remove-tiny-regions";

// Replaces a pixel with its most common neighbor value unless the source image shows a strong edge there.
export function despecklePaletteIndexes(
  paletteIndexes: Uint8Array,
  width: number,
  height: number,
  sourcePixels?: Uint8ClampedArray,
): Uint8Array {
  if (paletteIndexes.length !== width * height) {
    return new Uint8Array(paletteIndexes);
  }

  const usableSourcePixels = sourcePixels?.length === paletteIndexes.length * 4
    ? sourcePixels
    : undefined;
  const next = new Uint8Array(paletteIndexes);
  const neighborIndexes = new Int32Array(8);
  const neighborValues = new Uint8Array(8);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const current = paletteIndexes[index] ?? 0;

      let neighborCount = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const neighborIndex = ny * width + nx;
          neighborIndexes[neighborCount] = neighborIndex;
          neighborValues[neighborCount] = paletteIndexes[neighborIndex] ?? 0;
          neighborCount += 1;
        }
      }

      let currentVotes = 0;
      for (let i = 0; i < neighborCount; i += 1) {
        if (neighborValues[i] === current) currentVotes += 1;
      }

      let bestValue = -1;
      let bestVotes = currentVotes;
      for (let i = 0; i < neighborCount; i += 1) {
        const value = neighborValues[i] ?? 0;
        if (value === current) continue;
        let votes = 0;
        for (let j = 0; j < neighborCount; j += 1) {
          if (neighborValues[j] === value) votes += 1;
        }
        if (votes > bestVotes || (votes === bestVotes && value < bestValue)) {
          bestValue = value;
          bestVotes = votes;
        }
      }

      if (bestValue < 0) continue;

      if (usableSourcePixels) {
        let totalDifference = 0;
        let matchedCount = 0;
        for (let i = 0; i < neighborCount; i += 1) {
          if (neighborValues[i] !== bestValue) continue;
          totalDifference += sourceEdgeDifference(usableSourcePixels, index, neighborIndexes[i] ?? 0);
          matchedCount += 1;
        }
        const averageDifference = matchedCount ? totalDifference / matchedCount : 0;
        if (averageDifference > SOURCE_EDGE_THRESHOLD_SQUARED) continue;
      }

      next[index] = bestValue;
    }
  }

  return next;
}

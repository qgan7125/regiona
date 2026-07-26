interface ComponentMap {
  labels: Uint32Array;
  areas: number[];
  paletteIndexes: number[];
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
) {
  const threshold = Math.max(0, Math.floor(maximumArea));
  if (!threshold || paletteIndexes.length !== width * height) {
    return new Uint8Array(paletteIndexes);
  }

  const components = mapComponents(paletteIndexes, width, height);
  const neighborCounts: Array<Map<number, number> | undefined> = [];

  for (let index = 0; index < paletteIndexes.length; index += 1) {
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
      const counts = neighborCounts[componentIndex] ?? new Map<number, number>();
      counts.set(neighborComponentIndex, (counts.get(neighborComponentIndex) ?? 0) + 1);
      neighborCounts[componentIndex] = counts;
    }
  }

  const replacements = new Uint8Array(components.areas.length);
  for (let componentIndex = 0; componentIndex < components.areas.length; componentIndex += 1) {
    if ((components.areas[componentIndex] ?? 0) > threshold) continue;
    const neighbors = neighborCounts[componentIndex];
    if (!neighbors?.size) continue;

    let replacementComponent = -1;
    let sharedEdgeCount = -1;
    for (const [neighborComponent, count] of neighbors) {
      const candidatePalette = components.paletteIndexes[neighborComponent] ?? 0;
      const currentPalette = components.paletteIndexes[replacementComponent] ?? Number.MAX_SAFE_INTEGER;
      if (count > sharedEdgeCount || (count === sharedEdgeCount && candidatePalette < currentPalette)) {
        replacementComponent = neighborComponent;
        sharedEdgeCount = count;
      }
    }
    if (replacementComponent >= 0) {
      replacements[componentIndex] = (components.paletteIndexes[replacementComponent] ?? 0) + 1;
    }
  }

  const cleaned = new Uint8Array(paletteIndexes);
  for (let index = 0; index < cleaned.length; index += 1) {
    const replacement = replacements[(components.labels[index] ?? 0) - 1] ?? 0;
    if (replacement) cleaned[index] = replacement - 1;
  }
  return cleaned;
}

export interface SelectionRenderable {
  path: string;
  bounds: { x: number; y: number; width: number; height: number };
}

const MAX_SELECTION_PATH_CHARACTERS = 20_000;
const MAX_SELECTION_REGION_COUNT = 48;

/**
 * Caps selection rendering before the UI repeatedly parses enough SVG path
 * data to make pan, zoom, or brush interaction feel stalled.
 */
export function shouldUseSelectionTexture(regions: SelectionRenderable[]) {
  if (regions.length > MAX_SELECTION_REGION_COUNT) return true;

  return regions.reduce((total, region) => total + region.path.length, 0) >
    MAX_SELECTION_PATH_CHARACTERS;
}

export function selectedPixelMask(
  pixels: Uint8ClampedArray,
  labelMap: Uint32Array,
  selectedRegionNumbers: Set<number>,
) {
  const selectedPixels = new Uint8ClampedArray(pixels.length);
  for (let pixelIndex = 0; pixelIndex < labelMap.length; pixelIndex += 1) {
    if (!selectedRegionNumbers.has(labelMap[pixelIndex] ?? 0)) continue;
    const channelIndex = pixelIndex * 4;
    selectedPixels[channelIndex] = pixels[channelIndex] ?? 0;
    selectedPixels[channelIndex + 1] = pixels[channelIndex + 1] ?? 0;
    selectedPixels[channelIndex + 2] = pixels[channelIndex + 2] ?? 0;
    selectedPixels[channelIndex + 3] = pixels[channelIndex + 3] ?? 0;
  }
  return selectedPixels;
}

export function selectedPixelOutline(
  labelMap: Uint32Array,
  width: number,
  height: number,
  selectedRegionNumbers: Set<number>,
) {
  const outline = new Uint8ClampedArray(labelMap.length * 4);
  const isSelected = (x: number, y: number) => (
    x >= 0
    && x < width
    && y >= 0
    && y < height
    && selectedRegionNumbers.has(labelMap[y * width + x] ?? 0)
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isSelected(x, y)) continue;
      if (isSelected(x - 1, y) && isSelected(x + 1, y)
        && isSelected(x, y - 1) && isSelected(x, y + 1)) continue;
      const channelIndex = (y * width + x) * 4;
      outline[channelIndex] = 242;
      outline[channelIndex + 1] = 92;
      outline[channelIndex + 2] = 53;
      outline[channelIndex + 3] = 255;
    }
  }

  return outline;
}

export function selectionGraphicCacheKey(
  region: SelectionRenderable & { fill: string; opacity: number },
  viewportScale: number,
) {
  return `${region.path}\u0000${region.fill}\u0000${region.opacity}\u0000${viewportScale.toFixed(3)}`;
}

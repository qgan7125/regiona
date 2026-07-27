export interface SelectionRenderable {
  path: string;
  bounds: { x: number; y: number; width: number; height: number };
}

const MAX_SELECTION_PATH_CHARACTERS = 20_000;
const MAX_SELECTION_REGION_COUNT = 48;
export const SELECTION_TILE_SIZE = 256;

export interface SelectionTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export function selectedPixelMaskForTile(
  pixels: Uint8ClampedArray,
  labelMap: Uint32Array,
  imageWidth: number,
  tile: SelectionTile,
  selectedRegionNumbers: Set<number>,
) {
  const selectedPixels = new Uint8ClampedArray(tile.width * tile.height * 4);
  for (let tileY = 0; tileY < tile.height; tileY += 1) {
    for (let tileX = 0; tileX < tile.width; tileX += 1) {
      const sourcePixelIndex = (tile.y + tileY) * imageWidth + tile.x + tileX;
      if (!selectedRegionNumbers.has(labelMap[sourcePixelIndex] ?? 0)) continue;
      const sourceChannelIndex = sourcePixelIndex * 4;
      const targetChannelIndex = (tileY * tile.width + tileX) * 4;
      selectedPixels[targetChannelIndex] = pixels[sourceChannelIndex] ?? 0;
      selectedPixels[targetChannelIndex + 1] = pixels[sourceChannelIndex + 1] ?? 0;
      selectedPixels[targetChannelIndex + 2] = pixels[sourceChannelIndex + 2] ?? 0;
      selectedPixels[targetChannelIndex + 3] = pixels[sourceChannelIndex + 3] ?? 0;
    }
  }
  return selectedPixels;
}

export function selectedPixelOutlineForTile(
  labelMap: Uint32Array,
  imageWidth: number,
  imageHeight: number,
  tile: SelectionTile,
  selectedRegionNumbers: Set<number>,
) {
  const outline = new Uint8ClampedArray(tile.width * tile.height * 4);
  const isSelected = (x: number, y: number) => (
    x >= 0
    && x < imageWidth
    && y >= 0
    && y < imageHeight
    && selectedRegionNumbers.has(labelMap[y * imageWidth + x] ?? 0)
  );

  for (let tileY = 0; tileY < tile.height; tileY += 1) {
    const y = tile.y + tileY;
    for (let tileX = 0; tileX < tile.width; tileX += 1) {
      const x = tile.x + tileX;
      if (!isSelected(x, y)) continue;
      if (isSelected(x - 1, y) && isSelected(x + 1, y)
        && isSelected(x, y - 1) && isSelected(x, y + 1)) continue;
      const channelIndex = (tileY * tile.width + tileX) * 4;
      outline[channelIndex] = 242;
      outline[channelIndex + 1] = 92;
      outline[channelIndex + 2] = 53;
      outline[channelIndex + 3] = 255;
    }
  }

  return outline;
}

export function selectionTilesForRegionNumbers(
  regionNumbers: number[],
  regionBounds: Uint32Array,
  imageWidth: number,
  imageHeight: number,
  tileSize = SELECTION_TILE_SIZE,
) {
  const tiles = new Map<string, SelectionTile>();
  for (const regionNumber of regionNumbers) {
    const boundsOffset = regionNumber * 4;
    const x = regionBounds[boundsOffset] ?? 0;
    const y = regionBounds[boundsOffset + 1] ?? 0;
    const width = regionBounds[boundsOffset + 2] ?? 0;
    const height = regionBounds[boundsOffset + 3] ?? 0;
    if (!width || !height) continue;

    const minimumTileX = Math.floor(x / tileSize) * tileSize;
    const maximumTileX = Math.floor(Math.min(imageWidth - 1, x + width - 1) / tileSize) * tileSize;
    const minimumTileY = Math.floor(y / tileSize) * tileSize;
    const maximumTileY = Math.floor(Math.min(imageHeight - 1, y + height - 1) / tileSize) * tileSize;
    for (let tileY = minimumTileY; tileY <= maximumTileY; tileY += tileSize) {
      for (let tileX = minimumTileX; tileX <= maximumTileX; tileX += tileSize) {
        const key = `${tileX}:${tileY}`;
        tiles.set(key, {
          x: tileX,
          y: tileY,
          width: Math.min(tileSize, imageWidth - tileX),
          height: Math.min(tileSize, imageHeight - tileY),
        });
      }
    }
  }

  return [...tiles.values()].sort((left, right) => left.y - right.y || left.x - right.x);
}

export function selectionGraphicCacheKey(
  region: SelectionRenderable & { fill: string; opacity: number },
  viewportScale: number,
) {
  return `${region.path}\u0000${region.fill}\u0000${region.opacity}\u0000${viewportScale.toFixed(3)}`;
}

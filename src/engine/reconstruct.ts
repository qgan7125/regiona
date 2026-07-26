import type {
  ReconstructionResult,
  VisualRegion,
} from "../types/project";
import { quantizeImage } from "./color/quantize";
import { buildRegions } from "./regions/build-regions";
import { removeTinyPaletteRegions } from "./regions/remove-tiny-regions";
import { extractSharedBoundaries } from "./regions/shared-boundaries";
import { traceAllRegionPaths } from "./regions/trace-regions";

export interface ReconstructImageInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  targetColors: number;
  tinyRegionMaximumArea?: number;
  sourceFilename: string;
}

const parseHex = (hex: string): [number, number, number] => {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid region color: ${hex}`);
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

export function renderRegionPixels(
  labelMap: Uint32Array,
  regions: VisualRegion[],
) {
  const pixels = new Uint8ClampedArray(labelMap.length * 4);
  const colors = regions.map((region) => parseHex(region.fill));

  for (let index = 0; index < labelMap.length; index += 1) {
    const regionIndex = (labelMap[index] ?? 0) - 1;
    const color = colors[regionIndex] ?? [0, 0, 0];
    const offset = index * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = Math.round(
      Math.max(0, Math.min(1, regions[regionIndex]?.opacity ?? 1)) * 255,
    );
  }

  return pixels;
}

export function recolorRegion(
  regions: VisualRegion[],
  regionId: string,
  fill: string,
) {
  return recolorRegions(regions, [regionId], fill);
}

export function recolorRegions(
  regions: VisualRegion[],
  regionIds: string[],
  fill: string,
) {
  parseHex(fill);
  const selectedIds = new Set(regionIds);
  return regions.map((region) =>
    selectedIds.has(region.id) ? { ...region, fill: fill.toLowerCase() } : region,
  );
}

export function reconstructImage(
  input: ReconstructImageInput,
): ReconstructionResult {
  if (input.pixels.length !== input.width * input.height * 4) {
    throw new Error("Image dimensions do not match the RGBA pixel buffer.");
  }

  const { palette, paletteIndexes } = quantizeImage(
    input.pixels,
    input.targetColors,
  );
  const cleanedPaletteIndexes = removeTinyPaletteRegions(
    paletteIndexes,
    input.width,
    input.height,
    input.tinyRegionMaximumArea ?? 0,
  );
  const { labelMap, regions } = buildRegions(
    cleanedPaletteIndexes,
    input.width,
    input.height,
    palette,
  );
  const paths = traceAllRegionPaths(
    labelMap,
    input.width,
    input.height,
    regions.length,
  );
  const tracedRegions = regions.map((region, index) => ({
    ...region,
    pathData: paths[index] ?? [],
  }));
  const boundaries = extractSharedBoundaries(
    labelMap,
    input.width,
    input.height,
    tracedRegions,
  );

  return {
    width: input.width,
    height: input.height,
    sourceFilename: input.sourceFilename,
    palette,
    labelMap,
    regions: tracedRegions,
    boundaries,
    quantizedPixels: renderRegionPixels(labelMap, tracedRegions),
  };
}

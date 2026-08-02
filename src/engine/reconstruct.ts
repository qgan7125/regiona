import type {
  ReconstructionResult,
  VisualRegion,
} from "../types/project";
import { bilateralFilterPixels } from "./color/bilateral-filter";
import { quantizeImage } from "./color/quantize";
import { buildRegions } from "./regions/build-regions";
import { despecklePaletteIndexes } from "./regions/despeckle";
import { removeTinyPaletteRegions } from "./regions/remove-tiny-regions";
import { traceAllRegionPaths } from "./regions/trace-regions";

export interface ReconstructImageInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  targetColors: number;
  tinyRegionMaximumArea?: number;
  despeckleEnabled?: boolean;
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
  const normalizedFill = fill.toLowerCase();
  if (!regions.some((region) => selectedIds.has(region.id) && region.fill !== normalizedFill)) {
    return regions;
  }
  return regions.map((region) =>
    selectedIds.has(region.id) ? { ...region, fill: normalizedFill } : region,
  );
}

export function mergeSameFillRegions(
  result: ReconstructionResult,
  regionIds: string[],
): ReconstructionResult {
  const selectedIds = new Set(regionIds);
  if (selectedIds.size < 2) {
    throw new Error("Select at least two regions to merge.");
  }

  const selected = result.regions.filter((region) => selectedIds.has(region.id));
  if (selected.length !== selectedIds.size) {
    throw new Error("Every selected region must still exist before merging.");
  }

  const [primary, ...remaining] = selected;
  if (!primary) throw new Error("Select at least two regions to merge.");
  const normalizedFill = primary.fill.toLowerCase();
  if (remaining.some((region) => region.fill.toLowerCase() !== normalizedFill)) {
    throw new Error("Only regions with the same fill can be merged.");
  }
  if (remaining.some((region) => region.opacity !== primary.opacity)) {
    throw new Error("Only regions with the same opacity can be merged.");
  }

  const mergedRegion: VisualRegion = {
    ...primary,
    fill: normalizedFill,
    pixelArea: selected.reduce((area, region) => area + region.pixelArea, 0),
    bounds: mergeBounds(selected),
    pathData: selected.flatMap((region) => region.pathData),
  };
  const nextRegions = result.regions.flatMap((region) => {
    if (!selectedIds.has(region.id)) return [region];
    return region.id === primary.id ? [mergedRegion] : [];
  });
  const nextRegionNumbers = new Map(nextRegions.map((region, index) => [region.id, index + 1]));
  const regionNumberByPreviousNumber = result.regions.map((region) => (
    nextRegionNumbers.get(selectedIds.has(region.id) ? primary.id : region.id) ?? 0
  ));
  const labelMap = new Uint32Array(result.labelMap.length);
  for (let index = 0; index < result.labelMap.length; index += 1) {
    const previousNumber = result.labelMap[index] ?? 0;
    labelMap[index] = previousNumber > 0
      ? regionNumberByPreviousNumber[previousNumber - 1] ?? 0
      : 0;
  }

  return {
    ...result,
    labelMap,
    regions: nextRegions,
    quantizedPixels: renderRegionPixels(labelMap, nextRegions),
  };
}

function mergeBounds(regions: VisualRegion[]) {
  const left = Math.min(...regions.map((region) => region.bounds.x));
  const top = Math.min(...regions.map((region) => region.bounds.y));
  const right = Math.max(...regions.map((region) => region.bounds.x + region.bounds.width));
  const bottom = Math.max(...regions.map((region) => region.bounds.y + region.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function reconstructImage(
  input: ReconstructImageInput,
): ReconstructionResult {
  if (input.pixels.length !== input.width * input.height * 4) {
    throw new Error("Image dimensions do not match the RGBA pixel buffer.");
  }

  const smoothedPixels = bilateralFilterPixels(input.pixels, input.width, input.height);
  const { palette, paletteIndexes } = quantizeImage(
    smoothedPixels,
    input.targetColors,
  );
  const despeckledPaletteIndexes = input.despeckleEnabled ?? true
    ? despecklePaletteIndexes(paletteIndexes, input.width, input.height, input.pixels)
    : paletteIndexes;
  const cleanedPaletteIndexes = removeTinyPaletteRegions(
    despeckledPaletteIndexes,
    input.width,
    input.height,
    input.tinyRegionMaximumArea ?? 0,
    input.pixels,
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
    input.pixels,
  );
  const tracedRegions = regions.map((region, index) => ({
    ...region,
    pathData: paths[index] ?? [],
  }));

  return {
    width: input.width,
    height: input.height,
    sourceFilename: input.sourceFilename,
    palette,
    labelMap,
    regions: tracedRegions,
    quantizedPixels: renderRegionPixels(labelMap, tracedRegions),
  };
}

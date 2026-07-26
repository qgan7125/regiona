export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaletteColor {
  id: string;
  index: number;
  hex: string;
  rgba: [number, number, number, number];
  pixelCount: number;
  percentage: number;
}

export interface VisualRegion {
  id: string;
  colorId: string;
  fill: string;
  opacity: number;
  pixelArea: number;
  bounds: Rect;
  origin: "deterministic";
  pathData: string[];
}

export interface RasterPoint {
  x: number;
  y: number;
}

export interface RasterEdge {
  start: RasterPoint;
  end: RasterPoint;
}

/**
 * A canonical collection of raster edges shared by two regions, or by one
 * region and the outside of the source image when `regionBId` is omitted.
 */
export interface SharedBoundary {
  id: string;
  regionAId: string;
  regionBId?: string;
  rasterEdges: RasterEdge[];
}

/** A serializable view of the region adjacency graph. */
export interface RegionAdjacency {
  regionId: string;
  adjacentRegionIds: string[];
  boundaryIds: string[];
}

export interface RegionBuildResult {
  labelMap: Uint32Array;
  regions: VisualRegion[];
}

export interface EditableSvgInput {
  width: number;
  height: number;
  sourceFilename: string;
  regions: VisualRegion[];
}

export interface ReconstructionResult extends EditableSvgInput {
  palette: PaletteColor[];
  labelMap: Uint32Array;
  boundaries: SharedBoundary[];
  adjacency: RegionAdjacency[];
  quantizedPixels: Uint8ClampedArray;
}

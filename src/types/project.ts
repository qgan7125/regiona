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
  pixelArea: number;
  bounds: Rect;
  origin: "deterministic";
  pathData: string[];
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


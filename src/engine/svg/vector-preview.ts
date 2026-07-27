import type { ReconstructionResult } from "../../types/project";
import { resolveRegionPathData } from "./resolve-region-paths";

/** Generates the SVG consumed by the Pixi Vector preview. */
export function buildVectorPreviewSvg(result: ReconstructionResult) {
  const paths = result.regions
    .map((region) => {
      const pathData = resolveRegionPathData(result, region);
      return `<path d="${pathData.join(" ")}" fill="${region.fill}" fill-opacity="${region.opacity}" fill-rule="evenodd" />`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">${paths}</svg>`;
}

import type { EditableSvgInput, VisualRegion } from "../../types/project";
import { assembleSharedRegionPaths } from "./assemble-shared-paths";

/**
 * Resolves a region's SVG paths from canonical shared geometry whenever it is
 * available and valid, otherwise retaining the deterministic raster paths.
 */
export function resolveRegionPathData(
  input: EditableSvgInput,
  region: VisualRegion,
) {
  if (!input.labelMap || !input.boundaries) return region.pathData;

  return (
    assembleSharedRegionPaths({
      width: input.width,
      height: input.height,
      labelMap: input.labelMap,
      regions: input.regions,
      regionId: region.id,
      boundaries: input.boundaries,
    }) ?? region.pathData
  );
}

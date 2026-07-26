import type {
  RegionAdjacency,
  SharedBoundary,
  VisualRegion,
} from "../../types/project";

interface AdjacencyAccumulator {
  adjacentRegionIds: Set<string>;
  boundaryIds: Set<string>;
}

/**
 * Builds a deterministic, bidirectional adjacency graph from the canonical
 * shared-boundary list. Canvas-facing boundaries do not create neighbours.
 */
export function buildRegionAdjacency(
  regions: VisualRegion[],
  boundaries: SharedBoundary[],
): RegionAdjacency[] {
  const adjacency = new Map<string, AdjacencyAccumulator>(
    regions.map((region) => [
      region.id,
      { adjacentRegionIds: new Set<string>(), boundaryIds: new Set<string>() },
    ]),
  );

  for (const boundary of boundaries) {
    if (!boundary.regionBId) continue;

    const first = adjacency.get(boundary.regionAId);
    const second = adjacency.get(boundary.regionBId);
    if (!first || !second) {
      throw new Error(`Boundary ${boundary.id} references an unknown region.`);
    }

    first.adjacentRegionIds.add(boundary.regionBId);
    first.boundaryIds.add(boundary.id);
    second.adjacentRegionIds.add(boundary.regionAId);
    second.boundaryIds.add(boundary.id);
  }

  return regions.map((region) => {
    const entry = adjacency.get(region.id)!;
    return {
      regionId: region.id,
      adjacentRegionIds: [...entry.adjacentRegionIds].sort(),
      boundaryIds: [...entry.boundaryIds].sort(),
    };
  });
}

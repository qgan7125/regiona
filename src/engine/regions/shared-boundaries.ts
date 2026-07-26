import type {
  RasterEdge,
  SharedBoundary,
  VisualRegion,
} from "../../types/project";

interface BoundaryAccumulator {
  regionAId: string;
  regionBId?: string;
  rasterEdges: RasterEdge[];
}

function regionForLabel(regions: VisualRegion[], label: number) {
  const region = regions[label - 1];
  if (!region) throw new Error(`Unknown region number ${label}.`);
  return region;
}

/**
 * Returns each grid edge only once. Interior edges are owned by a canonical
 * region pair; canvas-facing edges are owned by their single region.
 */
export function extractSharedBoundaries(
  labelMap: Uint32Array,
  width: number,
  height: number,
  regions: VisualRegion[],
): SharedBoundary[] {
  if (labelMap.length !== width * height) {
    throw new Error("Label map dimensions are invalid.");
  }

  const boundaries = new Map<string, BoundaryAccumulator>();
  const addEdge = (
    firstLabel: number,
    secondLabel: number | undefined,
    rasterEdge: RasterEdge,
  ) => {
    const [regionALabel, regionBLabel] =
      secondLabel === undefined
        ? [firstLabel, undefined]
        : firstLabel < secondLabel
          ? [firstLabel, secondLabel]
          : [secondLabel, firstLabel];
    const regionA = regionForLabel(regions, regionALabel);
    const regionB =
      regionBLabel === undefined
        ? undefined
        : regionForLabel(regions, regionBLabel);
    const id = `boundary-${regionA.id}-${regionB?.id ?? "outside"}`;
    const boundary = boundaries.get(id) ?? {
      regionAId: regionA.id,
      regionBId: regionB?.id,
      rasterEdges: [],
    };

    boundary.rasterEdges.push(rasterEdge);
    boundaries.set(id, boundary);
  };

  const labelAt = (x: number, y: number) => labelMap[y * width + x] ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const label = labelAt(x, y);
      if (label === 0) continue;

      if (x + 1 < width) {
        const rightLabel = labelAt(x + 1, y);
        if (rightLabel !== label && rightLabel !== 0) {
          addEdge(label, rightLabel, {
            start: { x: x + 1, y },
            end: { x: x + 1, y: y + 1 },
          });
        }
      } else {
        addEdge(label, undefined, {
          start: { x: x + 1, y },
          end: { x: x + 1, y: y + 1 },
        });
      }

      if (y + 1 < height) {
        const bottomLabel = labelAt(x, y + 1);
        if (bottomLabel !== label && bottomLabel !== 0) {
          addEdge(label, bottomLabel, {
            start: { x: x + 1, y: y + 1 },
            end: { x, y: y + 1 },
          });
        }
      } else {
        addEdge(label, undefined, {
          start: { x: x + 1, y: y + 1 },
          end: { x, y: y + 1 },
        });
      }

      if (x === 0) {
        addEdge(label, undefined, {
          start: { x, y: y + 1 },
          end: { x, y },
        });
      }
      if (y === 0) {
        addEdge(label, undefined, {
          start: { x, y },
          end: { x: x + 1, y },
        });
      }
    }
  }

  return [...boundaries.entries()].map(([id, boundary]) => ({
    id,
    ...boundary,
  }));
}

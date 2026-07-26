import { describe, expect, it } from "vitest";

import { extractSharedBoundaries } from "../src/engine/regions/shared-boundaries";
import { buildRegionAdjacency } from "../src/engine/regions/build-adjacency";
import { fitRasterEdgesToLines } from "../src/engine/curves/fit-lines";
import type { VisualRegion } from "../src/types/project";

const regions: VisualRegion[] = [
  {
    id: "region-00001",
    colorId: "color-000",
    fill: "#111111",
    opacity: 1,
    pixelArea: 1,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    origin: "deterministic",
    pathData: [],
  },
  {
    id: "region-00002",
    colorId: "color-001",
    fill: "#eeeeee",
    opacity: 1,
    pixelArea: 1,
    bounds: { x: 1, y: 0, width: 1, height: 1 },
    origin: "deterministic",
    pathData: [],
  },
];

describe("extractSharedBoundaries", () => {
  it("stores a touching edge once for the pair of regions", () => {
    const boundaries = extractSharedBoundaries(new Uint32Array([1, 2]), 2, 1, regions);

    expect(boundaries).toContainEqual(
      expect.objectContaining({
        id: "boundary-region-00001-region-00002",
        regionAId: "region-00001",
        regionBId: "region-00002",
        rasterEdges: [
          {
            start: { x: 1, y: 0 },
            end: { x: 1, y: 1 },
          },
        ],
        vectorSegments: [
          {
            type: "line",
            start: { x: 1, y: 0 },
            end: { x: 1, y: 1 },
          },
        ],
        maximumFitErrorPx: 0,
        averageFitErrorPx: 0,
      }),
    );
  });

  it("records each canvas-facing edge against the outside exactly once", () => {
    const boundaries = extractSharedBoundaries(new Uint32Array([1, 2]), 2, 1, regions);
    const firstRegionOuterBoundary = boundaries.find(
      (boundary) => boundary.id === "boundary-region-00001-outside",
    );

    expect(firstRegionOuterBoundary?.rasterEdges).toHaveLength(3);
    expect(firstRegionOuterBoundary?.rasterEdges).toContainEqual({
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
    });
  });
});

describe("fitRasterEdgesToLines", () => {
  it("merges connected collinear raster edges without introducing error", () => {
    expect(
      fitRasterEdgesToLines([
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
        { start: { x: 1, y: 0 }, end: { x: 2, y: 0 } },
        { start: { x: 2, y: 0 }, end: { x: 2, y: 1 } },
      ]),
    ).toEqual({
      vectorSegments: [
        { type: "line", start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
        { type: "line", start: { x: 2, y: 0 }, end: { x: 2, y: 1 } },
      ],
      maximumFitErrorPx: 0,
      averageFitErrorPx: 0,
    });
  });
});

describe("buildRegionAdjacency", () => {
  it("connects both regions through their one shared boundary", () => {
    const boundaries = extractSharedBoundaries(new Uint32Array([1, 2]), 2, 1, regions);

    expect(buildRegionAdjacency(regions, boundaries)).toEqual([
      {
        regionId: "region-00001",
        adjacentRegionIds: ["region-00002"],
        boundaryIds: ["boundary-region-00001-region-00002"],
      },
      {
        regionId: "region-00002",
        adjacentRegionIds: ["region-00001"],
        boundaryIds: ["boundary-region-00001-region-00002"],
      },
    ]);
  });
});

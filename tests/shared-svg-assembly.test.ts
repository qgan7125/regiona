import { describe, expect, it } from "vitest";

import { assembleSharedRegionPaths } from "../src/engine/svg/assemble-shared-paths";
import type { SharedBoundary, VisualRegion } from "../src/types/project";

const region: VisualRegion = {
  id: "region-00001",
  colorId: "color-000",
  fill: "#111111",
  opacity: 1,
  pixelArea: 1,
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  origin: "deterministic",
  pathData: ["M legacy Z"],
};

const validTopology = {
  contourCount: 1,
  isContinuous: true,
  isClosed: false,
  hasSelfIntersection: false,
  isValid: true,
};

describe("assembleSharedRegionPaths", () => {
  it("uses an approved shared cubic boundary in the exported region path", () => {
    const boundaries: SharedBoundary[] = [
      {
        id: "boundary-region-00001-outside",
        regionAId: "region-00001",
        rasterEdges: [
          { start: { x: 1, y: 1 }, end: { x: 0, y: 1 } },
          { start: { x: 0, y: 1 }, end: { x: 0, y: 0 } },
          { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
        ],
        rasterContours: [[{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }]],
        vectorContours: [
          [
            {
              type: "cubic-bezier",
              start: { x: 1, y: 1 },
              control1: { x: 0, y: 1 },
              control2: { x: 0, y: 0 },
              end: { x: 1, y: 0 },
            },
          ],
        ],
        vectorSegments: [],
        maximumFitErrorPx: 0.5,
        averageFitErrorPx: 0.25,
        topology: validTopology,
      },
      {
        id: "boundary-region-00001-region-00002",
        regionAId: "region-00001",
        regionBId: "region-00002",
        rasterEdges: [{ start: { x: 1, y: 0 }, end: { x: 1, y: 1 } }],
        rasterContours: [[{ x: 1, y: 0 }, { x: 1, y: 1 }]],
        vectorContours: [
          [
            {
              type: "line",
              start: { x: 1, y: 0 },
              end: { x: 1, y: 1 },
            },
          ],
        ],
        vectorSegments: [],
        maximumFitErrorPx: 0,
        averageFitErrorPx: 0,
        topology: validTopology,
      },
    ];

    const paths = assembleSharedRegionPaths({
      width: 2,
      height: 1,
      labelMap: new Uint32Array([1, 2]),
      regions: [region],
      regionId: region.id,
      boundaries,
    });

    expect(paths).toHaveLength(1);
    expect(paths?.[0]).toContain("C 0 1 0 0 1 0");
    expect(paths?.[0]).not.toContain("legacy");
  });

  it("returns no assembled path when a region boundary fails topology validation", () => {
    const invalidBoundary: SharedBoundary = {
      id: "boundary-region-00001-outside",
      regionAId: region.id,
      rasterEdges: [
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
        { start: { x: 1, y: 0 }, end: { x: 1, y: 1 } },
        { start: { x: 1, y: 1 }, end: { x: 0, y: 1 } },
        { start: { x: 0, y: 1 }, end: { x: 0, y: 0 } },
      ],
      rasterContours: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }]],
      vectorContours: [[]],
      vectorSegments: [],
      maximumFitErrorPx: 0,
      averageFitErrorPx: 0,
      topology: { ...validTopology, isValid: false, hasSelfIntersection: true },
    };

    expect(
      assembleSharedRegionPaths({
        width: 1,
        height: 1,
        labelMap: new Uint32Array([1]),
        regions: [region],
        regionId: region.id,
        boundaries: [invalidBoundary],
      }),
    ).toBeUndefined();
  });
});

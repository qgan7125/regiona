import { describe, expect, it } from "vitest";

import {
  fitPolylineToCubicBezier,
  fitRasterEdgesToCurves,
} from "../src/engine/curves/fit-curves";

describe("fitPolylineToCubicBezier", () => {
  it("returns a cubic segment only when its measured error fits the tolerance", () => {
    const fitted = fitPolylineToCubicBezier(
      [
        { x: 0, y: 0 },
        { x: 0.55, y: 3.38 },
        { x: 3, y: 4.5 },
        { x: 5.45, y: 3.38 },
        { x: 6, y: 0 },
      ],
      1,
    );

    expect(fitted?.segment.type).toBe("cubic-bezier");
    expect(fitted?.maximumFitErrorPx).toBeLessThanOrEqual(1);
    expect(fitted?.averageFitErrorPx).toBeLessThanOrEqual(1);
  });
});

describe("fitRasterEdgesToCurves", () => {
  it("splits a long curved boundary into error-bounded cubic segments", () => {
    const result = fitRasterEdgesToCurves(
      [
        { start: { x: 0, y: 0 }, end: { x: 1, y: 2 } },
        { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
        { start: { x: 3, y: 4 }, end: { x: 6, y: 5 } },
        { start: { x: 6, y: 5 }, end: { x: 9, y: 4 } },
        { start: { x: 9, y: 4 }, end: { x: 11, y: 2 } },
        { start: { x: 11, y: 2 }, end: { x: 12, y: 0 } },
        { start: { x: 12, y: 0 }, end: { x: 13, y: -2 } },
        { start: { x: 13, y: -2 }, end: { x: 15, y: -4 } },
        { start: { x: 15, y: -4 }, end: { x: 18, y: -5 } },
        { start: { x: 18, y: -5 }, end: { x: 21, y: -4 } },
        { start: { x: 21, y: -4 }, end: { x: 23, y: -2 } },
        { start: { x: 23, y: -2 }, end: { x: 24, y: 0 } },
      ],
      0.5,
    );

    const cubicSegments = result.vectorSegments.filter(
      (segment) => segment.type === "cubic-bezier",
    );

    expect(cubicSegments).toHaveLength(2);
    expect(result.maximumFitErrorPx).toBeLessThanOrEqual(0.5);
  });

  it("keeps exact lines when a cubic would exceed the configured error limit", () => {
    const result = fitRasterEdgesToCurves(
      [
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
        { start: { x: 1, y: 0 }, end: { x: 2, y: 0 } },
        { start: { x: 2, y: 0 }, end: { x: 2, y: 1 } },
      ],
      0.1,
    );

    expect(result.vectorSegments).toEqual([
      { type: "line", start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
      { type: "line", start: { x: 2, y: 0 }, end: { x: 2, y: 1 } },
    ]);
    expect(result.maximumFitErrorPx).toBe(0);
    expect(result.averageFitErrorPx).toBe(0);
  });
});

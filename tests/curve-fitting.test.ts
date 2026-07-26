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

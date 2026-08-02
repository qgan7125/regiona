import { describe, expect, it } from "vitest";

import {
  comparisonCamera,
  zoomComparisonTransformAtPoint,
} from "../src/preview/comparison-camera";

describe("comparison camera", () => {
  it("maps the same normalized focus point onto differently sized images", () => {
    expect(comparisonCamera(
      { width: 200, height: 100 },
      { width: 400, height: 300 },
      { zoom: 100, center: { x: 0.25, y: 0.75 } },
    )).toEqual({ scale: 2, x: 100, y: 0 });

    expect(comparisonCamera(
      { width: 1000, height: 500 },
      { width: 400, height: 300 },
      { zoom: 100, center: { x: 0.25, y: 0.75 } },
    )).toEqual({ scale: 0.4, x: 100, y: 0 });
  });

  it("keeps the cursor's image point stable while zooming", () => {
    const next = zoomComparisonTransformAtPoint(
      { width: 200, height: 100 },
      { width: 400, height: 300 },
      { zoom: 100, center: { x: 0.5, y: 0.5 } },
      { x: 100, y: 100 },
      200,
    );

    expect(next).toEqual({ zoom: 200, center: { x: 0.375, y: 0.375 } });
  });
});

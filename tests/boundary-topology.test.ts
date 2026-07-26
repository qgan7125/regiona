import { describe, expect, it } from "vitest";

import { validateVectorContours } from "../src/engine/topology/validate-boundaries";
import type { VectorSegment } from "../src/types/project";

describe("validateVectorContours", () => {
  it("accepts a continuous closed contour without self-intersection", () => {
    const square: VectorSegment[] = [
      { type: "line", start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
      { type: "line", start: { x: 2, y: 0 }, end: { x: 2, y: 2 } },
      { type: "line", start: { x: 2, y: 2 }, end: { x: 0, y: 2 } },
      { type: "line", start: { x: 0, y: 2 }, end: { x: 0, y: 0 } },
    ];

    expect(validateVectorContours([square])).toEqual({
      contourCount: 1,
      isContinuous: true,
      isClosed: true,
      hasSelfIntersection: false,
      isValid: true,
    });
  });

  it("rejects a closed bow-tie contour with a self-intersection", () => {
    const bowTie: VectorSegment[] = [
      { type: "line", start: { x: 0, y: 0 }, end: { x: 2, y: 2 } },
      { type: "line", start: { x: 2, y: 2 }, end: { x: 0, y: 2 } },
      { type: "line", start: { x: 0, y: 2 }, end: { x: 2, y: 0 } },
      { type: "line", start: { x: 2, y: 0 }, end: { x: 0, y: 0 } },
    ];

    expect(validateVectorContours([bowTie])).toEqual({
      contourCount: 1,
      isContinuous: true,
      isClosed: true,
      hasSelfIntersection: true,
      isValid: false,
    });
  });
});

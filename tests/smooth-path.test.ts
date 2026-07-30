import { describe, expect, it } from "vitest";

import { smoothClosedPolygonPath } from "../src/engine/geometry/smooth-path";

function regularPolygon(sides: number, radius: number) {
  return Array.from({ length: sides + 1 }, (_, index) => {
    const angle = ((index % sides) / sides) * 2 * Math.PI;
    return {
      x: Math.round(radius * Math.cos(angle) * 100) / 100,
      y: Math.round(radius * Math.sin(angle) * 100) / 100,
    };
  });
}

describe("smoothClosedPolygonPath", () => {
  it("matches the plain orthogonal output for a rectangle (all hard corners)", () => {
    const rectangle = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ];

    expect(smoothClosedPolygonPath(rectangle)).toBe("M 0 0 H 2 V 2 H 0 Z");
  });

  it("keeps every edge straight for an L-shape (all 90 degree corners)", () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];

    const path = smoothClosedPolygonPath(lShape);

    expect(path).not.toContain("C ");
    expect(path.endsWith("Z")).toBe(true);
  });

  it("fits curves through every vertex of a gentle regular polygon (no hard corners)", () => {
    // each turn is 360/16 = 22.5 degrees, well under the hard-corner threshold
    const ring = regularPolygon(16, 10);

    const path = smoothClosedPolygonPath(ring);

    expect(path).not.toContain("H ");
    expect(path).not.toContain("V ");
    expect(path).not.toContain(" L ");
    expect((path.match(/C /g) ?? []).length).toBe(16);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("returns an empty string for a degenerate (too-small) loop", () => {
    expect(smoothClosedPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe("");
  });
});

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

  it("forces anchor points to stay hard corners even when their angle reads as smooth", () => {
    // Every vertex of this ring has a gentle 22.5 degree turn (see the test above), so
    // without isAnchor every edge becomes a curve. Marking two adjacent vertices as
    // anchors - as if they were junctions shared with another region - must make the edge
    // between them straight, regardless of what the geometric angle test alone would decide.
    const ring = regularPolygon(16, 10);
    const anchorA = ring[0]!;
    const anchorB = ring[1]!;
    const isAnchor = (point: { x: number; y: number }) =>
      (point.x === anchorA.x && point.y === anchorA.y)
      || (point.x === anchorB.x && point.y === anchorB.y);

    const path = smoothClosedPolygonPath(ring, isAnchor);
    const commands = path.match(/[A-Z][^A-Z]*/g) ?? [];

    // the edge from vertex 0 to vertex 1 is the first drawn command after "M"
    expect(commands[1]?.startsWith("L")).toBe(true);
    // every other edge is still a curve, unaffected by the two forced anchors
    expect((path.match(/C /g) ?? []).length).toBe(15);
  });
});

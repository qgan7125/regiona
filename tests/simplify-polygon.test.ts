import { describe, expect, it } from "vitest";

import { simplifyClosedPolygon } from "../src/engine/geometry/simplify-polygon";

describe("simplifyClosedPolygon", () => {
  it("leaves an already-simple rectangle untouched", () => {
    const rectangle = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
      { x: 0, y: 0 },
    ];

    expect(simplifyClosedPolygon(rectangle)).toEqual(rectangle);
  });

  it("collapses a staircase hypotenuse while keeping the triangle's real corners", () => {
    // A right triangle: straight bottom edge, straight left edge, and a
    // staircase-traced hypotenuse from (10,0) to (0,10).
    const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    let x = 10;
    let y = 0;
    while (x > 0 || y < 10) {
      if (x > 0) {
        x -= 1;
        points.push({ x, y });
      }
      if (y < 10) {
        y += 1;
        points.push({ x, y });
      }
    }
    points.push({ x: 0, y: 0 });

    const simplified = simplifyClosedPolygon(points);

    expect(simplified.length).toBeLessThan(points.length / 2);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified.some((point) => point.x === 10 && point.y === 0)).toBe(true);
    expect(simplified.some((point) => point.x === 0 && point.y === 10)).toBe(true);
    expect(simplified[simplified.length - 1]).toEqual(simplified[0]);
  });

  it("keeps every genuine corner of an L-shape at the default tolerance", () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];

    expect(simplifyClosedPolygon(lShape)).toEqual(lShape);
  });
});

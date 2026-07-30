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

  it("simplifies a shared staircase edge identically for both regions that trace it", () => {
    // Two regions share a staircase boundary from (0,0) to (10,10), each closed off
    // by a different, unrelated route on their own side - like two adjacent regions
    // in a real traced image, where only the (0,0)/(10,10) endpoints are junctions.
    const staircase: Array<{ x: number; y: number }> = [];
    let x = 0;
    let y = 0;
    staircase.push({ x, y });
    while (x < 10 || y < 10) {
      if (x < 10) {
        x += 1;
        staircase.push({ x, y });
      }
      if (y < 10) {
        y += 1;
        staircase.push({ x, y });
      }
    }

    const isAnchor = (point: { x: number; y: number }) =>
      (point.x === 0 && point.y === 0) || (point.x === 10 && point.y === 10);

    const loopA = [
      ...staircase,
      { x: 20, y: 10 },
      { x: 20, y: -10 },
      { x: 0, y: -10 },
      { x: 0, y: 0 },
    ];
    const loopB = [
      ...[...staircase].reverse(),
      { x: -10, y: 0 },
      { x: -10, y: 20 },
      { x: 10, y: 20 },
      { x: 10, y: 10 },
    ];

    const simplifiedA = simplifyClosedPolygon(loopA, isAnchor);
    const simplifiedB = simplifyClosedPolygon(loopB, isAnchor);

    const withinStaircaseBounds = (point: { x: number; y: number }) =>
      point.x >= 0 && point.x <= 10 && point.y >= 0 && point.y <= 10;
    // Each simplified loop is made of exactly two chains between the (0,0)/(10,10)
    // anchors: the staircase and the region's own unrelated closing route. Pick
    // whichever of the two possible slices stays within the staircase's bounds, and
    // normalize its direction so both regions' chains can be compared directly.
    const staircaseChainOf = (loop: Array<{ x: number; y: number }>) => {
      const cyclic = loop.slice(0, -1);
      const startIndex = cyclic.findIndex((point) => point.x === 0 && point.y === 0);
      const endIndex = cyclic.findIndex((point) => point.x === 10 && point.y === 10);
      const lo = Math.min(startIndex, endIndex);
      const hi = Math.max(startIndex, endIndex);
      const forwardSlice = cyclic.slice(lo, hi + 1);
      const wrapSlice = [...cyclic.slice(hi), ...cyclic.slice(0, lo + 1)];
      const chain = forwardSlice.every(withinStaircaseBounds) ? forwardSlice : wrapSlice;
      return chain[0]!.x === 0 && chain[0]!.y === 0 ? chain : chain.slice().reverse();
    };

    expect(staircaseChainOf(simplifiedA)).toEqual(staircaseChainOf(simplifiedB));
  });
});

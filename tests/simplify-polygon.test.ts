import { describe, expect, it } from "vitest";

import { simplifyClosedPolygon } from "../src/engine/geometry/simplify-polygon";

// Rotates a closed loop (first point repeated at the end) so it starts at its
// lexicographically smallest point, for order-independent shape comparisons - which
// anchor pair simplification picks first is an implementation detail, not part of the
// contract; what matters is the resulting shape.
function normalizeRotation(loop: Array<{ x: number; y: number }>) {
  const cyclic = loop.slice(0, -1);
  let startIndex = 0;
  for (let index = 1; index < cyclic.length; index += 1) {
    const candidate = cyclic[index]!;
    const current = cyclic[startIndex]!;
    if (candidate.x < current.x || (candidate.x === current.x && candidate.y < current.y)) {
      startIndex = index;
    }
  }
  const rotated = [...cyclic.slice(startIndex), ...cyclic.slice(0, startIndex)];
  return [...rotated, rotated[0]!];
}

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
    expect(simplified.some((point) => point.x === 0 && point.y === 0)).toBe(true);
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

    expect(normalizeRotation(simplifyClosedPolygon(lShape))).toEqual(normalizeRotation(lShape));
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

  it("breaks an exact deviation tie the same way regardless of trace direction", () => {
    // Captured from a real reconstruction that produced a visible gap: this 62-point
    // staircase contains a recursive split where two candidate points sit at exactly the
    // same perpendicular distance (2.0) from the chord. Scanning forward reaches one
    // first; scanning the exact reverse reaches the other first. Without a
    // direction-independent tie-break, that single differing choice cascaded through the
    // rest of the recursion and produced a materially different final shape depending on
    // which region traced the edge first.
    const chain = [
      { x: 120, y: 38 }, { x: 119, y: 38 }, { x: 119, y: 39 }, { x: 118, y: 39 }, { x: 118, y: 38 },
      { x: 117, y: 38 }, { x: 117, y: 39 }, { x: 115, y: 39 }, { x: 115, y: 40 }, { x: 111, y: 40 },
      { x: 111, y: 39 }, { x: 108, y: 39 }, { x: 108, y: 40 }, { x: 98, y: 40 }, { x: 98, y: 39 },
      { x: 92, y: 39 }, { x: 92, y: 40 }, { x: 85, y: 40 }, { x: 85, y: 41 }, { x: 82, y: 41 },
      { x: 82, y: 40 }, { x: 81, y: 40 }, { x: 81, y: 38 }, { x: 78, y: 38 }, { x: 78, y: 39 },
      { x: 77, y: 39 }, { x: 77, y: 40 }, { x: 69, y: 40 }, { x: 69, y: 41 }, { x: 68, y: 41 },
      { x: 68, y: 40 }, { x: 61, y: 40 }, { x: 61, y: 39 }, { x: 60, y: 39 }, { x: 60, y: 40 },
      { x: 57, y: 40 }, { x: 57, y: 41 }, { x: 53, y: 41 }, { x: 53, y: 40 }, { x: 49, y: 40 },
      { x: 49, y: 41 }, { x: 45, y: 41 }, { x: 45, y: 40 }, { x: 36, y: 40 }, { x: 36, y: 39 },
      { x: 31, y: 39 }, { x: 31, y: 40 }, { x: 28, y: 40 }, { x: 28, y: 39 }, { x: 27, y: 39 },
      { x: 27, y: 40 }, { x: 25, y: 40 }, { x: 25, y: 41 }, { x: 23, y: 41 }, { x: 23, y: 40 },
      { x: 15, y: 40 }, { x: 15, y: 41 }, { x: 13, y: 41 }, { x: 13, y: 40 }, { x: 12, y: 40 },
      { x: 12, y: 39 }, { x: 9, y: 39 },
    ];

    const isAnchor = (point: { x: number; y: number }) =>
      (point.x === 120 && point.y === 38) || (point.x === 9 && point.y === 39);

    const loopA = [...chain, { x: 120, y: 60 }, { x: 9, y: 60 }, { x: 120, y: 38 }];
    const loopB = [...[...chain].reverse(), { x: 9, y: 20 }, { x: 120, y: 20 }, { x: 9, y: 39 }];

    const simplifiedA = simplifyClosedPolygon(loopA, isAnchor);
    const simplifiedB = simplifyClosedPolygon(loopB, isAnchor);

    // Each simplified loop is made of exactly two chains between the two anchors: the
    // real shared staircase and this test's own closing route. Extract whichever slice
    // stays within the staircase's y-range, normalized to start at (120,38).
    const sharedEdgeOf = (loop: Array<{ x: number; y: number }>) => {
      const cyclic = loop.slice(0, -1);
      const startIndex = cyclic.findIndex((point) => point.x === 120 && point.y === 38);
      const endIndex = cyclic.findIndex((point) => point.x === 9 && point.y === 39);
      const lo = Math.min(startIndex, endIndex);
      const hi = Math.max(startIndex, endIndex);
      const forwardSlice = cyclic.slice(lo, hi + 1);
      const wrapSlice = [...cyclic.slice(hi), ...cyclic.slice(0, lo + 1)];
      const withinStaircaseRange = (point: { x: number; y: number }) => point.y >= 38 && point.y <= 41;
      const chain = forwardSlice.every(withinStaircaseRange) ? forwardSlice : wrapSlice;
      return chain[0]!.x === 120 && chain[0]!.y === 38 ? chain : chain.slice().reverse();
    };

    expect(sharedEdgeOf(simplifiedA)).toEqual(sharedEdgeOf(simplifiedB));
  });

  it("agrees on a fallback anchor pair for a fully enclosed hole with no junction anywhere", () => {
    // A small region entirely surrounded by just one other region (e.g. an eye inside a
    // face) has no 3-way junction and no image-border contact anywhere on its boundary, so
    // simplifyClosedPolygon must fall back to a scan-order-independent anchor choice. The
    // outer region traces this hole's boundary starting from one arbitrary point (wherever
    // its own pixel scan first touched it); the inner region traces its own outer boundary
    // starting from a different arbitrary point. Both are the exact same physical loop,
    // just rotated to a different starting index - simplification must agree regardless.
    const radius = 12;
    const loop: Array<{ x: number; y: number }> = [];
    const steps = 40;
    for (let index = 0; index < steps; index += 1) {
      const angle = (index / steps) * 2 * Math.PI;
      loop.push({
        x: Math.round(radius + radius * Math.cos(angle)),
        y: Math.round(radius + radius * Math.sin(angle)),
      });
    }
    const closedLoop = [...loop, loop[0]!];

    const rotate = (source: Array<{ x: number; y: number }>, offset: number) => {
      const cyclic = source.slice(0, -1);
      const n = cyclic.length;
      const rotated = Array.from({ length: n }, (_, index) => cyclic[(index + offset) % n]!);
      return [...rotated, rotated[0]!];
    };

    // No isAnchor function passed - this loop has zero real junctions, forcing the
    // fallback path for both "regions".
    const simplifiedFromStart = simplifyClosedPolygon(rotate(closedLoop, 0));
    const simplifiedFromOffset = simplifyClosedPolygon(rotate(closedLoop, 17));

    expect(normalizeRotation(simplifiedFromStart)).toEqual(normalizeRotation(simplifiedFromOffset));
  });
});

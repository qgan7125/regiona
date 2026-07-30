interface Point {
  x: number;
  y: number;
}

const DEFAULT_TOLERANCE = 1;

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const cross = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x);
  return cross / Math.sqrt(lengthSquared);
}

function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const start = points[0]!;
  const end = points[points.length - 1]!;

  let maxDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index]!, start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= tolerance) return [start, end];

  const left = douglasPeucker(points.slice(0, splitIndex + 1), tolerance);
  const right = douglasPeucker(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

// Reduces a closed pixel-traced boundary to its key vertices within a pixel tolerance,
// collapsing staircase noise while leaving already-simple shapes (like a plain
// rectangle, 5 points including the closing duplicate) untouched.
export function simplifyClosedPolygon(points: Point[], tolerance = DEFAULT_TOLERANCE): Point[] {
  if (points.length <= 5) return points;

  const loop = points.slice(0, -1);
  const n = loop.length;
  const anchor = Math.floor(n / 2);
  const firstChain = loop.slice(0, anchor + 1);
  const secondChain = [...loop.slice(anchor), loop[0]!];
  const simplifiedFirst = douglasPeucker(firstChain, tolerance);
  const simplifiedSecond = douglasPeucker(secondChain, tolerance);
  const merged = [...simplifiedFirst.slice(0, -1), ...simplifiedSecond.slice(0, -1)];

  if (merged.length < 3) return points;
  return [...merged, merged[0]!];
}

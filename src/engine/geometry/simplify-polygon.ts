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
//
// `isAnchor` marks points that must survive simplification unchanged - in practice,
// junctions where this region's boundary meets two or more other regions. Douglas-Peucker
// only runs on the stretches between anchors, so it never has to choose an arbitrary split
// point along a boundary shared with another region: both regions independently detect the
// same junctions (a purely local property of the label map) and therefore keep the exact
// same anchor points, so a shared edge simplifies identically on both sides. Without any
// anchors (an isolated region with no neighbor to disagree with), it falls back to two
// opposite points so Douglas-Peucker still has bounded chains to work on.
export function simplifyClosedPolygon(
  points: Point[],
  isAnchor: (point: Point) => boolean = () => false,
  tolerance = DEFAULT_TOLERANCE,
): Point[] {
  if (points.length <= 5) return points;

  const loop = points.slice(0, -1);
  const n = loop.length;
  const at = (index: number) => loop[((index % n) + n) % n]!;

  let anchorIndexes = loop.reduce<number[]>((found, point, index) => {
    if (isAnchor(point)) found.push(index);
    return found;
  }, []);
  if (anchorIndexes.length < 2) anchorIndexes = [0, Math.floor(n / 2)];

  const merged: Point[] = [];
  for (let anchor = 0; anchor < anchorIndexes.length; anchor += 1) {
    const startIndex = anchorIndexes[anchor]!;
    const endIndex = anchorIndexes[(anchor + 1) % anchorIndexes.length]!;
    const chainLength = ((endIndex - startIndex + n) % n) || n;
    const chain = Array.from({ length: chainLength + 1 }, (_, offset) => at(startIndex + offset));
    const simplified = douglasPeucker(chain, tolerance);
    merged.push(...simplified.slice(0, -1));
  }

  if (merged.length < 3) return points;
  return [...merged, merged[0]!];
}

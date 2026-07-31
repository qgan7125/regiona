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

// Ties in perpendicular distance are common on regular staircases (several steps can sit
// at the exact same deviation from the chord), and picking "whichever the scan reaches
// first" is not symmetric under reversal - a chain and its exact mirror can then pick
// different split points and recurse into different shapes entirely, even though the
// physical boundary is identical. Breaking ties by point coordinates instead of scan order
// keeps the split choice - and everything downstream of it - the same regardless of which
// direction a shared edge happens to be traced from.
function isEarlierTiebreak(candidate: Point, current: Point) {
  return candidate.x < current.x || (candidate.x === current.x && candidate.y < current.y);
}

function comparePoints(a: Point, b: Point) {
  return a.x - b.x || a.y - b.y;
}

// Finds the two points farthest apart in a loop - a purely geometric property of the point
// set, independent of scan order or wherever in the array the loop happens to start. Used
// as a fallback anchor pair when no junction-based anchors exist: a small region fully
// enclosed by just one other region (a hole with no third region and no image-border
// contact) has no natural junction anywhere on its boundary, so both sides tracing that
// boundary would otherwise fall back to an arbitrary index-based split - which, same as
// Douglas-Peucker's own tie-breaking, is not symmetric under reversal, since each side's
// array happens to start at a different physical point. The two farthest-apart points are
// the same regardless of where the array starts, so both sides agree on this fallback pair
// too. Ties (common for symmetric shapes) are broken by comparing point coordinates, not
// array position, for the same reason.
function findFarthestIndexes(loop: Point[]): [number, number] {
  let bestI = 0;
  let bestJ = Math.min(1, loop.length - 1);
  let bestDistance = -1;

  for (let i = 0; i < loop.length; i += 1) {
    for (let j = i + 1; j < loop.length; j += 1) {
      const dx = loop[i]!.x - loop[j]!.x;
      const dy = loop[i]!.y - loop[j]!.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) continue;

      const [a1, a2] = comparePoints(loop[i]!, loop[j]!) <= 0 ? [loop[i]!, loop[j]!] : [loop[j]!, loop[i]!];
      const [b1, b2] = comparePoints(loop[bestI]!, loop[bestJ]!) <= 0 ? [loop[bestI]!, loop[bestJ]!] : [loop[bestJ]!, loop[bestI]!];
      const tieOrder = comparePoints(a1, b1) || comparePoints(a2, b2);
      if (distance > bestDistance || tieOrder < 0) {
        bestDistance = distance;
        bestI = i;
        bestJ = j;
      }
    }
  }

  return [bestI, bestJ];
}

// Finds the loop point farthest from a given reference point. Used when exactly one real
// junction exists on a loop: both sides of that boundary already agree on the junction's
// coordinates (a shared, local property of the label map), so picking a second anchor
// relative to that shared point - rather than an unrelated independent search - keeps the
// choice consistent between them for the same reason findFarthestIndexes does.
function findFarthestIndexFrom(loop: Point[], fromIndex: number): number {
  const from = loop[fromIndex]!;
  let bestIndex = fromIndex === 0 ? Math.min(1, loop.length - 1) : 0;
  let bestDistance = -1;

  for (let index = 0; index < loop.length; index += 1) {
    if (index === fromIndex) continue;
    const point = loop[index]!;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const distance = dx * dx + dy * dy;
    if (
      distance > bestDistance
      || (distance === bestDistance && comparePoints(point, loop[bestIndex]!) < 0)
    ) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const start = points[0]!;
  const end = points[points.length - 1]!;

  let maxDistance = 0;
  let splitIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const distance = perpendicularDistance(point, start, end);
    if (
      distance > maxDistance
      || (distance === maxDistance && isEarlierTiebreak(point, points[splitIndex]!))
    ) {
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
  if (anchorIndexes.length === 0) {
    anchorIndexes = findFarthestIndexes(loop);
  } else if (anchorIndexes.length === 1) {
    // A single real junction still isn't enough to bound a Douglas-Peucker chain (that
    // needs two endpoints), and discarding it in favor of an unrelated anchor pair would
    // reopen the exact inconsistency this anchoring scheme exists to prevent: a neighboring
    // region that happens to pass through this same junction twice (e.g. a thin one-pixel
    // spike touching it from both sides) keeps it as two real anchors, and an independent
    // fallback here would pick a completely different second point instead of agreeing.
    anchorIndexes = [anchorIndexes[0]!, findFarthestIndexFrom(loop, anchorIndexes[0]!)];
  }

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

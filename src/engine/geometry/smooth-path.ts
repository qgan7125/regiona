interface Point {
  x: number;
  y: number;
}

const CORNER_ANGLE_DEGREES = 60;
const CORNER_ANGLE_COSINE = Math.cos((CORNER_ANGLE_DEGREES * Math.PI) / 180);

// A vertex reads as a hard corner (kept sharp, never smoothed) when its turn angle is
// tighter than this threshold. Depends only on a vertex and its immediate neighbors, so
// both sides of a shared boundary classify it the same way regardless of trace direction.
function isHardCorner(previous: Point, current: Point, next: Point): boolean {
  const inX = current.x - previous.x;
  const inY = current.y - previous.y;
  const outX = next.x - current.x;
  const outY = next.y - current.y;
  const inLength = Math.hypot(inX, inY);
  const outLength = Math.hypot(outX, outY);
  if (!inLength || !outLength) return true;
  const cosine = (inX * outX + inY * outY) / (inLength * outLength);
  return cosine < CORNER_ANGLE_COSINE;
}

const round = (value: number) => Math.round(value * 100) / 100;

// Fits a smooth closed curve through a simplified polygon using Catmull-Rom-derived
// Bezier segments. Hard corners stay as straight line commands so genuine right angles
// are not rounded off; gentler turns become curves.
//
// `isAnchor` marks points that must always be treated as hard corners - junctions shared
// with other regions. The plain geometric angle test alone isn't enough there: two regions
// meeting at the same junction usually approach it from different directions on their own
// side, so the angle test can call it a corner on one side and a smooth point on the other,
// making one side draw a straight line into the junction and the other a curve - an instant
// gap right at the point both sides otherwise agree on. Forcing every anchor to be a hard
// corner keeps that agreement extending to how the curve touches it, not just where.
export function smoothClosedPolygonPath(
  points: Point[],
  isAnchor: (point: Point) => boolean = () => false,
): string {
  const loop = points.slice(0, -1);
  const n = loop.length;
  if (n < 3) return "";

  const at = (index: number) => loop[((index % n) + n) % n]!;
  const corner = Array.from({ length: n }, (_, index) =>
    isAnchor(at(index)) || isHardCorner(at(index - 1), at(index), at(index + 1)));

  const commands = [`M ${round(at(0).x)} ${round(at(0).y)}`];
  for (let index = 0; index < n; index += 1) {
    const start = at(index);
    const end = at(index + 1);
    const before = at(index - 1);
    const after = at(index + 2);
    const startIsCorner = corner[index];
    const endIsCorner = corner[(index + 1) % n];
    const isClosingEdge = index === n - 1;

    if (startIsCorner && endIsCorner) {
      if (isClosingEdge) continue; // Z already draws the final straight edge back to the start
      if (end.y === start.y) commands.push(`H ${round(end.x)}`);
      else if (end.x === start.x) commands.push(`V ${round(end.y)}`);
      else commands.push(`L ${round(end.x)} ${round(end.y)}`);
      continue;
    }

    // Chord-length-scaled (non-uniform) Catmull-Rom tangents: simplified vertices can sit
    // at wildly different spacings (a short border-hugging edge next to a long collapsed
    // staircase run), and the classic uniform-spacing tangent formula overshoots badly
    // when neighboring segment lengths differ. Scaling by each segment's share of the two
    // adjacent chord lengths keeps control points proportionate - and, since distances are
    // symmetric, this stays exactly as reversal-symmetric as the uniform formula was.
    const dBefore = Math.hypot(start.x - before.x, start.y - before.y);
    const dHere = Math.hypot(end.x - start.x, end.y - start.y);
    const dAfter = Math.hypot(after.x - end.x, after.y - end.y);
    const leadingScale = dBefore + dHere ? dHere / (dBefore + dHere) / 3 : 0;
    const trailingScale = dHere + dAfter ? dHere / (dHere + dAfter) / 3 : 0;

    const control1 = startIsCorner
      ? start
      : { x: start.x + (end.x - before.x) * leadingScale, y: start.y + (end.y - before.y) * leadingScale };
    const control2 = endIsCorner
      ? end
      : { x: end.x - (after.x - start.x) * trailingScale, y: end.y - (after.y - start.y) * trailingScale };

    commands.push(
      `C ${round(control1.x)} ${round(control1.y)} ${round(control2.x)} ${round(control2.y)} ${round(end.x)} ${round(end.y)}`,
    );
  }
  commands.push("Z");
  return commands.join(" ");
}

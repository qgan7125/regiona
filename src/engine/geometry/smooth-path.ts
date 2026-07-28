interface Point {
  x: number;
  y: number;
}

const CORNER_ANGLE_DEGREES = 60;
const CORNER_ANGLE_COSINE = Math.cos((CORNER_ANGLE_DEGREES * Math.PI) / 180);
const CURVE_TENSION = 6;

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
export function smoothClosedPolygonPath(points: Point[]): string {
  const loop = points.slice(0, -1);
  const n = loop.length;
  if (n < 3) return "";

  const at = (index: number) => loop[((index % n) + n) % n]!;
  const corner = Array.from({ length: n }, (_, index) =>
    isHardCorner(at(index - 1), at(index), at(index + 1)));

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

    const control1 = startIsCorner
      ? start
      : { x: start.x + (end.x - before.x) / CURVE_TENSION, y: start.y + (end.y - before.y) / CURVE_TENSION };
    const control2 = endIsCorner
      ? end
      : { x: end.x - (after.x - start.x) / CURVE_TENSION, y: end.y - (after.y - start.y) / CURVE_TENSION };

    commands.push(
      `C ${round(control1.x)} ${round(control1.y)} ${round(control2.x)} ${round(control2.y)} ${round(end.x)} ${round(end.y)}`,
    );
  }
  commands.push("Z");
  return commands.join(" ");
}

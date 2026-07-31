import { oklabDistanceSquared, rgbToOklab } from "../color/oklab";

interface Point {
  x: number;
  y: number;
}

const MAX_DISPLACEMENT = 0.7;
const SAMPLE_RANGE = 1;
const SAMPLE_COUNT = 15;
// OKLab squared distance a normal-line gradient must clear to count as a real edge rather
// than sensor/quantization noise. Calibrated against synthetic gray-level data: +/-6 to
// +/-12 (typical sensor noise) tops out around 0.00005-0.00011; a 30-unit RGB step (a
// modest but real edge) reads about 0.00042. This sits comfortably above the noise range
// while still catching edges well short of a bold, high-contrast transition.
const MIN_GRADIENT_SQUARED = 0.00015;

function unitVector(dx: number, dy: number): Point {
  const length = Math.hypot(dx, dy);
  return length ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}

// Traced boundary points sit at pixel corners (lattice points where up to 4 pixels meet),
// while the source buffer is indexed by pixel centers (pixel i holds the color at i+0.5).
// Shift by -0.5 so a corner coordinate samples the pixel grid at the right place.
function sampleRgb(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const cx = Math.max(0, Math.min(width - 1.001, x - 0.5));
  const cy = Math.max(0, Math.min(height - 1.001, y - 0.5));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;

  const at = (px: number, py: number) => {
    const offset = (py * width + px) * 4;
    return [pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0] as const;
  };
  const c00 = at(x0, y0);
  const c10 = at(x1, y0);
  const c01 = at(x0, y1);
  const c11 = at(x1, y1);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return [0, 1, 2].map((channel) =>
    lerp(lerp(c00[channel]!, c10[channel]!, fx), lerp(c01[channel]!, c11[channel]!, fx), fy)) as [number, number, number];
}

// Shifts a single boundary point along its local normal to the position of steepest color
// gradient in the original (unquantized, unsmoothed) image, recovering the true sub-pixel
// edge location instead of leaving it pinned to the pixel lattice. Reversal symmetry: the
// normal is a line, not a signed direction (rotating a tangent or its exact opposite by 90
// degrees gives the same line, sign flipped), and searching the full sample range in both
// directions finds the same physical steepest-gradient location regardless of which way
// `previous`/`next` are ordered - two regions tracing the same shared point from opposite
// directions compute the identical refined position.
function refinePoint(
  point: Point,
  previous: Point,
  next: Point,
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
): Point {
  const tangent = unitVector(next.x - previous.x, next.y - previous.y);
  if (!tangent.x && !tangent.y) return point;
  const normal: Point = { x: -tangent.y, y: tangent.x };

  const offsets: number[] = [];
  const samples: Array<{ l: number; a: number; b: number }> = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const t = -SAMPLE_RANGE + (2 * SAMPLE_RANGE * index) / (SAMPLE_COUNT - 1);
    offsets.push(t);
    const [r, g, b] = sampleRgb(sourcePixels, width, height, point.x + normal.x * t, point.y + normal.y * t);
    samples.push(rgbToOklab(r, g, b));
  }

  // Tie-break by distance from the sample range's center, not scan order: the sample set
  // is mirrored (not just reversed) for a region tracing this point the other way around
  // (index i <-> N-2-i, an exact bit-for-bit reflection - see the module comment), so
  // "first occurrence wins" would let the two sides land on different physical gradient
  // peaks whenever two candidates tie exactly, the same class of bug fixed for Douglas-
  // Peucker's own tie-breaking. Distance-from-center is preserved by that reflection, so
  // it always resolves a tie to the same physical location regardless of trace direction.
  let maxGradient = -1;
  let maxIndex = -1;
  const centerIndex = (samples.length - 2) / 2;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const gradient = oklabDistanceSquared(samples[index]!, samples[index + 1]!);
    if (
      gradient > maxGradient
      || (gradient === maxGradient && Math.abs(index - centerIndex) < Math.abs(maxIndex - centerIndex))
    ) {
      maxGradient = gradient;
      maxIndex = index;
    }
  }
  if (maxIndex < 0 || maxGradient < MIN_GRADIENT_SQUARED) return point;

  const midOffset = (offsets[maxIndex]! + offsets[maxIndex + 1]!) / 2;
  const clamped = Math.max(-MAX_DISPLACEMENT, Math.min(MAX_DISPLACEMENT, midOffset));

  return { x: point.x + normal.x * clamped, y: point.y + normal.y * clamped };
}

// Refines every non-anchor vertex of a closed polygon to a sub-pixel position using the
// original source image. Anchors (junctions shared with other regions) are left exactly
// where they are - moving a junction independently on each side it touches would reopen
// the shared-edge consistency gap already fixed for polygon simplification and curve
// smoothing.
export function refineClosedPolygonSubpixel(
  points: Point[],
  sourcePixels: Uint8ClampedArray | undefined,
  width: number,
  height: number,
  isAnchor: (point: Point) => boolean = () => false,
): Point[] {
  if (!sourcePixels || sourcePixels.length !== width * height * 4) return points;

  const loop = points.slice(0, -1);
  const n = loop.length;
  if (n < 3) return points;

  const at = (index: number) => loop[((index % n) + n) % n]!;
  const refined = loop.map((point, index) => (isAnchor(point)
    ? point
    : refinePoint(point, at(index - 1), at(index + 1), sourcePixels, width, height)));

  return [...refined, refined[0]!];
}

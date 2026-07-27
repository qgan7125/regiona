import type {
  CubicBezierSegment,
  RasterEdge,
  RasterPoint,
  VectorSegment,
} from "../../types/project";
import { connectRasterEdges, fitPolylineToLines } from "./fit-lines";

interface CubicFitResult {
  segment: CubicBezierSegment;
  maximumFitErrorPx: number;
  averageFitErrorPx: number;
  sampleCount: number;
}

interface CurveFitResult {
  rasterContours: RasterPoint[][];
  vectorContours: VectorSegment[][];
  vectorSegments: VectorSegment[];
  maximumFitErrorPx: number;
  averageFitErrorPx: number;
}

const distance = (left: RasterPoint, right: RasterPoint) =>
  Math.hypot(right.x - left.x, right.y - left.y);

const subtract = (left: RasterPoint, right: RasterPoint): RasterPoint => ({
  x: left.x - right.x,
  y: left.y - right.y,
});

const scale = (point: RasterPoint, amount: number): RasterPoint => ({
  x: point.x * amount,
  y: point.y * amount,
});

const add = (...points: RasterPoint[]): RasterPoint =>
  points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );

const dot = (left: RasterPoint, right: RasterPoint) =>
  left.x * right.x + left.y * right.y;

function normalize(point: RasterPoint) {
  const length = Math.hypot(point.x, point.y);
  return length === 0 ? { x: 0, y: 0 } : scale(point, 1 / length);
}

function allCollinear(points: RasterPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return true;

  return points.every(
    (point) =>
      (point.x - first.x) * (last.y - first.y) ===
      (point.y - first.y) * (last.x - first.x),
  );
}

function chordLengthParameters(points: RasterPoint[]) {
  const distances = points.slice(1).map((point, index) =>
    distance(points[index]!, point),
  );
  const totalLength = distances.reduce((total, value) => total + value, 0);
  if (totalLength === 0) return points.map(() => 0);

  let cumulativeLength = 0;
  return points.map((_, index) => {
    if (index > 0) cumulativeLength += distances[index - 1] ?? 0;
    return cumulativeLength / totalLength;
  });
}

function evaluateCubic(segment: CubicBezierSegment, t: number): RasterPoint {
  const inverseT = 1 - t;
  return add(
    scale(segment.start, inverseT ** 3),
    scale(segment.control1, 3 * inverseT ** 2 * t),
    scale(segment.control2, 3 * inverseT * t ** 2),
    scale(segment.end, t ** 3),
  );
}

/**
 * Fits one cubic Bézier to a non-linear polyline using chord-length
 * parameterisation. No cubic is returned unless every source point is within
 * `maximumErrorPx`, so callers can safely fall back to exact lines.
 */
export function fitPolylineToCubicBezier(
  points: RasterPoint[],
  maximumErrorPx: number,
): CubicFitResult | undefined {
  if (maximumErrorPx < 0) {
    throw new Error("Curve fit tolerance must not be negative.");
  }
  if (points.length < 4 || allCollinear(points)) return undefined;

  const start = points[0]!;
  const end = points[points.length - 1]!;
  const startTangent = normalize(subtract(points[1]!, start));
  const endTangent = normalize(subtract(points[points.length - 2]!, end));
  if (
    (startTangent.x === 0 && startTangent.y === 0) ||
    (endTangent.x === 0 && endTangent.y === 0)
  ) {
    return undefined;
  }

  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  const parameters = chordLengthParameters(points);

  points.forEach((point, index) => {
    const t = parameters[index] ?? 0;
    const inverseT = 1 - t;
    const b0 = inverseT ** 3;
    const b1 = 3 * inverseT ** 2 * t;
    const b2 = 3 * inverseT * t ** 2;
    const b3 = t ** 3;
    const a1 = scale(startTangent, b1);
    const a2 = scale(endTangent, b2);
    const temporary = subtract(
      point,
      add(scale(start, b0 + b1), scale(end, b2 + b3)),
    );

    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    x0 += dot(a1, temporary);
    x1 += dot(a2, temporary);
  });

  const determinant = c00 * c11 - c01 * c01;
  const chordLength = distance(start, end);
  const fallbackAlpha = chordLength / 3;
  const alphaStart =
    Math.abs(determinant) < 1e-8
      ? fallbackAlpha
      : (x0 * c11 - x1 * c01) / determinant;
  const alphaEnd =
    Math.abs(determinant) < 1e-8
      ? fallbackAlpha
      : (c00 * x1 - c01 * x0) / determinant;
  if (alphaStart <= 1e-8 || alphaEnd <= 1e-8) return undefined;

  const segment: CubicBezierSegment = {
    type: "cubic-bezier",
    start,
    control1: add(start, scale(startTangent, alphaStart)),
    control2: add(end, scale(endTangent, alphaEnd)),
    end,
  };
  const errors = points.map((point, index) =>
    distance(point, evaluateCubic(segment, parameters[index] ?? 0)),
  );
  const maximumFitError = Math.max(...errors);
  const averageFitError =
    errors.reduce((total, error) => total + error, 0) / errors.length;
  if (maximumFitError > maximumErrorPx) return undefined;

  return {
    segment,
    maximumFitErrorPx: maximumFitError,
    averageFitErrorPx: averageFitError,
    sampleCount: points.length,
  };
}

interface ContourFitResult {
  segments: VectorSegment[];
  maximumFitErrorPx: number;
  accumulatedError: number;
  sampleCount: number;
}

const exactLineFit = (points: RasterPoint[]): ContourFitResult => ({
  segments: fitPolylineToLines(points),
  maximumFitErrorPx: 0,
  accumulatedError: 0,
  sampleCount: 0,
});

/**
 * Recursively splits a boundary when one cubic exceeds the allowed error.
 * This keeps each accepted Bézier within tolerance instead of throwing the
 * complete boundary away and reverting it to its pixel staircase.
 */
function fitPolylineToCubicSegments(
  points: RasterPoint[],
  maximumErrorPx: number,
): ContourFitResult {
  if (allCollinear(points)) return exactLineFit(points);

  const cubic = fitPolylineToCubicBezier(points, maximumErrorPx);
  if (cubic) {
    return {
      segments: [cubic.segment],
      maximumFitErrorPx: cubic.maximumFitErrorPx,
      accumulatedError: cubic.averageFitErrorPx * cubic.sampleCount,
      sampleCount: cubic.sampleCount,
    };
  }

  // A split needs at least three source segments on each side for a cubic.
  // Smaller runs remain exact straight lines rather than inventing geometry.
  if (points.length < 7) return exactLineFit(points);

  const splitIndex = Math.floor((points.length - 1) / 2);
  const left = fitPolylineToCubicSegments(
    points.slice(0, splitIndex + 1),
    maximumErrorPx,
  );
  const right = fitPolylineToCubicSegments(
    points.slice(splitIndex),
    maximumErrorPx,
  );

  return {
    segments: [...left.segments, ...right.segments],
    maximumFitErrorPx: Math.max(
      left.maximumFitErrorPx,
      right.maximumFitErrorPx,
    ),
    accumulatedError: left.accumulatedError + right.accumulatedError,
    sampleCount: left.sampleCount + right.sampleCount,
  };
}

export function fitRasterEdgesToCurves(
  edges: RasterEdge[],
  maximumErrorPx: number,
): CurveFitResult {
  let maximumFitErrorPx = 0;
  let accumulatedError = 0;
  let sampleCount = 0;
  const vectorSegments: VectorSegment[] = [];
  const vectorContours: VectorSegment[][] = [];
  const rasterContours = connectRasterEdges(edges);

  for (const polyline of rasterContours) {
    const fitted = fitPolylineToCubicSegments(polyline, maximumErrorPx);
    maximumFitErrorPx = Math.max(maximumFitErrorPx, fitted.maximumFitErrorPx);
    accumulatedError += fitted.accumulatedError;
    sampleCount += fitted.sampleCount;
    vectorContours.push(fitted.segments);
    vectorSegments.push(...fitted.segments);
  }

  return {
    rasterContours,
    vectorContours,
    vectorSegments,
    maximumFitErrorPx,
    averageFitErrorPx: sampleCount === 0 ? 0 : accumulatedError / sampleCount,
  };
}

import type {
  BoundaryTopology,
  RasterPoint,
  VectorSegment,
} from "../../types/project";

const EPSILON = 1e-6;

const pointsEqual = (left: RasterPoint, right: RasterPoint) =>
  Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;

const orientation = (first: RasterPoint, second: RasterPoint, third: RasterPoint) =>
  (second.x - first.x) * (third.y - first.y) -
  (second.y - first.y) * (third.x - first.x);

function liesOnSegment(
  start: RasterPoint,
  point: RasterPoint,
  end: RasterPoint,
) {
  return (
    Math.min(start.x, end.x) - EPSILON <= point.x &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    Math.min(start.y, end.y) - EPSILON <= point.y &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  );
}

function lineSegmentsIntersect(
  firstStart: RasterPoint,
  firstEnd: RasterPoint,
  secondStart: RasterPoint,
  secondEnd: RasterPoint,
) {
  const firstOrientationStart = orientation(firstStart, firstEnd, secondStart);
  const firstOrientationEnd = orientation(firstStart, firstEnd, secondEnd);
  const secondOrientationStart = orientation(secondStart, secondEnd, firstStart);
  const secondOrientationEnd = orientation(secondStart, secondEnd, firstEnd);
  const firstCrosses =
    (firstOrientationStart > EPSILON && firstOrientationEnd < -EPSILON) ||
    (firstOrientationStart < -EPSILON && firstOrientationEnd > EPSILON);
  const secondCrosses =
    (secondOrientationStart > EPSILON && secondOrientationEnd < -EPSILON) ||
    (secondOrientationStart < -EPSILON && secondOrientationEnd > EPSILON);

  if (firstCrosses && secondCrosses) return true;
  return (
    (Math.abs(firstOrientationStart) <= EPSILON &&
      liesOnSegment(firstStart, secondStart, firstEnd)) ||
    (Math.abs(firstOrientationEnd) <= EPSILON &&
      liesOnSegment(firstStart, secondEnd, firstEnd)) ||
    (Math.abs(secondOrientationStart) <= EPSILON &&
      liesOnSegment(secondStart, firstStart, secondEnd)) ||
    (Math.abs(secondOrientationEnd) <= EPSILON &&
      liesOnSegment(secondStart, firstEnd, secondEnd))
  );
}

function cubicPoint(segment: Extract<VectorSegment, { type: "cubic-bezier" }>, t: number) {
  const inverseT = 1 - t;
  return {
    x:
      segment.start.x * inverseT ** 3 +
      segment.control1.x * 3 * inverseT ** 2 * t +
      segment.control2.x * 3 * inverseT * t ** 2 +
      segment.end.x * t ** 3,
    y:
      segment.start.y * inverseT ** 3 +
      segment.control1.y * 3 * inverseT ** 2 * t +
      segment.control2.y * 3 * inverseT * t ** 2 +
      segment.end.y * t ** 3,
  };
}

function sampleSegment(segment: VectorSegment) {
  if (segment.type === "line") return [segment.start, segment.end];
  return Array.from({ length: 17 }, (_, index) => cubicPoint(segment, index / 16));
}

function contourHasSelfIntersection(segments: VectorSegment[], isClosed: boolean) {
  const sampledLines = segments.flatMap((segment, segmentIndex) => {
    const points = sampleSegment(segment);
    return points.slice(1).map((end, index) => ({
      start: points[index]!,
      end,
      segmentIndex,
    }));
  });

  for (let firstIndex = 0; firstIndex < sampledLines.length; firstIndex += 1) {
    const first = sampledLines[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < sampledLines.length; secondIndex += 1) {
      const second = sampledLines[secondIndex]!;
      if (first.segmentIndex === second.segmentIndex) continue;
      const areAdjacent = Math.abs(first.segmentIndex - second.segmentIndex) === 1;
      const joinAtClosure =
        isClosed &&
        ((first.segmentIndex === 0 && second.segmentIndex === segments.length - 1) ||
          (second.segmentIndex === 0 && first.segmentIndex === segments.length - 1));
      if (areAdjacent || joinAtClosure) continue;
      if (lineSegmentsIntersect(first.start, first.end, second.start, second.end)) {
        return true;
      }
    }
  }

  return false;
}

function validateContour(segments: VectorSegment[]) {
  if (segments.length === 0) {
    return { isContinuous: false, isClosed: false, hasSelfIntersection: false };
  }
  const isContinuous = segments.every((segment, index) =>
    index === 0 || pointsEqual(segments[index - 1]!.end, segment.start),
  );
  const isClosed = isContinuous && pointsEqual(segments[0]!.start, segments.at(-1)!.end);
  return {
    isContinuous,
    isClosed,
    hasSelfIntersection:
      isContinuous && contourHasSelfIntersection(segments, isClosed),
  };
}

/** Validates contour continuity, closure and intersections before SVG use. */
export function validateVectorContours(
  contours: VectorSegment[][],
): BoundaryTopology {
  const contourResults = contours.map(validateContour);
  const isContinuous = contourResults.every((result) => result.isContinuous);
  const hasSelfIntersection = contourResults.some(
    (result) => result.hasSelfIntersection,
  );
  const isClosed =
    contours.length > 0 && contourResults.every((result) => result.isClosed);

  return {
    contourCount: contours.length,
    isContinuous,
    isClosed,
    hasSelfIntersection,
    isValid: isContinuous && !hasSelfIntersection,
  };
}

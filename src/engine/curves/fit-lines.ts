import type {
  RasterEdge,
  RasterPoint,
  VectorSegment,
} from "../../types/project";

interface LineFitResult {
  vectorSegments: VectorSegment[];
  maximumFitErrorPx: number;
  averageFitErrorPx: number;
}

const pointKey = ({ x, y }: RasterPoint) => `${x},${y}`;

const comparePoints = (left: RasterPoint, right: RasterPoint) =>
  left.x - right.x || left.y - right.y;

function otherPoint(edge: RasterEdge, point: RasterPoint) {
  return pointKey(edge.start) === pointKey(point) ? edge.end : edge.start;
}

function isCollinear(
  first: RasterPoint,
  middle: RasterPoint,
  last: RasterPoint,
) {
  return (
    (middle.x - first.x) * (last.y - middle.y) ===
    (middle.y - first.y) * (last.x - middle.x)
  );
}

function connectRasterEdges(edges: RasterEdge[]) {
  const edgeIndexesAtPoint = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    for (const point of [edge.start, edge.end]) {
      const key = pointKey(point);
      const indexes = edgeIndexesAtPoint.get(key) ?? [];
      indexes.push(index);
      edgeIndexesAtPoint.set(key, indexes);
    }
  });

  const unused = new Set(edges.map((_, index) => index));
  const polylines: RasterPoint[][] = [];

  while (unused.size > 0) {
    const availablePoints = [...unused].flatMap((index) => {
      const edge = edges[index]!;
      return [edge.start, edge.end];
    });
    const start = [...availablePoints]
      .filter(
        (point) =>
          (edgeIndexesAtPoint.get(pointKey(point)) ?? []).filter((index) =>
            unused.has(index),
          ).length !== 2,
      )
      .sort(comparePoints)[0] ?? availablePoints.sort(comparePoints)[0]!;
    const points = [start];
    let current = start;
    let previousEdgeIndex: number | undefined;

    while (true) {
      const candidateIndexes = (edgeIndexesAtPoint.get(pointKey(current)) ?? [])
        .filter((index) => unused.has(index))
        .filter((index) => index !== previousEdgeIndex)
        .sort((left, right) =>
          comparePoints(otherPoint(edges[left]!, current), otherPoint(edges[right]!, current)),
        );
      const nextEdgeIndex = candidateIndexes[0];
      if (nextEdgeIndex === undefined) break;

      const nextPoint = otherPoint(edges[nextEdgeIndex]!, current);
      unused.delete(nextEdgeIndex);
      points.push(nextPoint);
      previousEdgeIndex = nextEdgeIndex;
      current = nextPoint;

      const remainingAtPoint = (edgeIndexesAtPoint.get(pointKey(current)) ?? [])
        .filter((index) => unused.has(index)).length;
      if (remainingAtPoint === 0 || pointKey(current) === pointKey(start)) break;
      if (
        (edgeIndexesAtPoint.get(pointKey(current)) ?? []).length !== 2
      ) {
        break;
      }
    }

    if (points.length > 1) polylines.push(points);
  }

  return polylines;
}

function simplifyPolyline(points: RasterPoint[]) {
  if (points.length <= 2) return points;
  const simplified = [points[0]!];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    if (!isCollinear(previous, current, next)) simplified.push(current);
  }

  simplified.push(points[points.length - 1]!);
  return simplified;
}

/**
 * Produces exact line segments from raster boundaries. Contiguous collinear
 * edges collapse into one segment, so the measured fitting error is zero.
 */
export function fitRasterEdgesToLines(edges: RasterEdge[]): LineFitResult {
  const vectorSegments = connectRasterEdges(edges).flatMap((polyline) => {
    const points = simplifyPolyline(polyline);
    return points.slice(1).map((end, index) => ({
      type: "line" as const,
      start: points[index]!,
      end,
    }));
  });

  return {
    vectorSegments,
    maximumFitErrorPx: 0,
    averageFitErrorPx: 0,
  };
}

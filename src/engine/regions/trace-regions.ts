import { simplifyClosedPolygon } from "../geometry/simplify-polygon";
import { smoothClosedPolygonPath } from "../geometry/smooth-path";

interface Point {
  x: number;
  y: number;
}

interface Edge {
  start: Point;
  end: Point;
  used: boolean;
}

const pointKey = ({ x, y }: Point) => `${x},${y}`;

const direction = (edge: Edge) => {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
};

function chooseNextEdge(current: Edge, candidates: Edge[]) {
  const currentDirection = direction(current);
  const preference = [1, 0, 3, 2];
  return [...candidates].sort((left, right) => {
    const leftTurn = (direction(left) - currentDirection + 4) % 4;
    const rightTurn = (direction(right) - currentDirection + 4) % 4;
    return preference.indexOf(leftTurn) - preference.indexOf(rightTurn);
  })[0];
}

function simplifyLoop(points: Point[]) {
  if (points.length <= 4) return points;
  const simplified: Point[] = [points[0] ?? { x: 0, y: 0 }];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1] ?? points[0]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const isCollinear =
      (previous.x === current.x && current.x === next.x) ||
      (previous.y === current.y && current.y === next.y);
    if (!isCollinear) simplified.push(current);
  }

  simplified.push(points[points.length - 1] ?? simplified[0]!);
  return simplified;
}

function pointsToPath(points: Point[], isAnchor: (point: Point) => boolean) {
  const collinearSimplified = simplifyLoop(points);
  const polygon = simplifyClosedPolygon(collinearSimplified, isAnchor);
  return smoothClosedPolygonPath(polygon);
}

function traceEdges(edges: Edge[], isAnchor: (point: Point) => boolean) {
  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = pointKey(edge.start);
    const atPoint = outgoing.get(key) ?? [];
    atPoint.push(edge);
    outgoing.set(key, atPoint);
  }

  const paths: string[] = [];
  for (const firstEdge of edges) {
    if (firstEdge.used) continue;
    const points: Point[] = [firstEdge.start, firstEdge.end];
    firstEdge.used = true;
    let current = firstEdge;
    let guard = 0;

    while (
      pointKey(current.end) !== pointKey(firstEdge.start) &&
      guard < edges.length
    ) {
      const candidates = (outgoing.get(pointKey(current.end)) ?? []).filter(
        (edge) => !edge.used,
      );
      const next = chooseNextEdge(current, candidates);
      if (!next) throw new Error("Region boundary contains an open contour.");
      next.used = true;
      points.push(next.end);
      current = next;
      guard += 1;
    }

    const path = pointsToPath(points, isAnchor);
    if (path) paths.push(path);
  }

  return paths;
}

const edge = (start: Point, end: Point): Edge => ({
  start,
  end,
  used: false,
});

// A junction is a boundary point where 3 or more distinct region labels meet at the
// surrounding pixel corners. It is a purely local property of the label map, so every
// region touching that point independently detects the exact same junctions - which is
// what lets simplifyClosedPolygon anchor shared edges identically on both sides without
// needing any cross-region bookkeeping.
function buildJunctionLookup(labelMap: Uint32Array, width: number, height: number) {
  const labelAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height ? (labelMap[y * width + x] ?? 0) : 0;
  const cornerWidth = width + 1;
  const junctions = new Uint8Array(cornerWidth * (height + 1));

  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      const distinctLabels = new Set([
        labelAt(x - 1, y - 1),
        labelAt(x, y - 1),
        labelAt(x - 1, y),
        labelAt(x, y),
      ]);
      // The 4 outermost image corners collapse 3 of their 4 surrounding cells into a
      // single out-of-bounds label, so a boundary that simply runs corner-to-corner
      // (e.g. a plain two-region diagonal split, no third region anywhere) would never
      // reach the 3-distinct-label threshold there. Anchor them unconditionally instead -
      // both regions bordering an image corner trivially agree on its coordinates.
      const isImageCorner = (x === 0 || x === width) && (y === 0 || y === height);
      if (isImageCorner || distinctLabels.size >= 3) junctions[y * cornerWidth + x] = 1;
    }
  }

  return (point: Point) => junctions[point.y * cornerWidth + point.x] === 1;
}

export function traceAllRegionPaths(
  labelMap: Uint32Array,
  width: number,
  height: number,
  regionCount: number,
): string[][] {
  if (labelMap.length !== width * height) {
    throw new Error("Label map dimensions are invalid.");
  }

  const regionEdges = Array.from({ length: regionCount }, () => [] as Edge[]);
  const labelAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height
      ? (labelMap[y * width + x] ?? 0)
      : 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const regionNumber = labelAt(x, y);
      if (regionNumber === 0) continue;
      const edges = regionEdges[regionNumber - 1];
      if (!edges) throw new Error(`Unknown region number ${regionNumber}.`);

      if (labelAt(x, y - 1) !== regionNumber)
        edges.push(edge({ x, y }, { x: x + 1, y }));
      if (labelAt(x + 1, y) !== regionNumber)
        edges.push(edge({ x: x + 1, y }, { x: x + 1, y: y + 1 }));
      if (labelAt(x, y + 1) !== regionNumber)
        edges.push(edge({ x: x + 1, y: y + 1 }, { x, y: y + 1 }));
      if (labelAt(x - 1, y) !== regionNumber)
        edges.push(edge({ x, y: y + 1 }, { x, y }));
    }
  }

  const isAnchor = buildJunctionLookup(labelMap, width, height);
  return regionEdges.map((edges) => traceEdges(edges, isAnchor));
}

export function traceRegionPaths(
  labelMap: Uint32Array,
  width: number,
  height: number,
  regionNumber: number,
): string[] {
  let maximumLabel = regionNumber;
  for (const label of labelMap) maximumLabel = Math.max(maximumLabel, label);
  const allPaths = traceAllRegionPaths(
    labelMap,
    width,
    height,
    maximumLabel,
  );
  return allPaths[regionNumber - 1] ?? [];
}

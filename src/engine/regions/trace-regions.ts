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

function pointsToPath(points: Point[]) {
  const simplified = simplifyLoop(points);
  const start = simplified[0];
  if (!start) return "";
  const commands = [`M ${start.x} ${start.y}`];

  for (let index = 1; index < simplified.length - 1; index += 1) {
    const previous = simplified[index - 1]!;
    const point = simplified[index]!;
    if (point.y === previous.y) commands.push(`H ${point.x}`);
    else if (point.x === previous.x) commands.push(`V ${point.y}`);
    else commands.push(`L ${point.x} ${point.y}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

export function traceRegionPaths(
  labelMap: Uint32Array,
  width: number,
  height: number,
  regionNumber: number,
): string[] {
  if (labelMap.length !== width * height) {
    throw new Error("Label map dimensions are invalid.");
  }

  const edges: Edge[] = [];
  const addEdge = (start: Point, end: Point) =>
    edges.push({ start, end, used: false });
  const isRegion = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    (labelMap[y * width + x] ?? 0) === regionNumber;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isRegion(x, y)) continue;
      if (!isRegion(x, y - 1)) addEdge({ x, y }, { x: x + 1, y });
      if (!isRegion(x + 1, y))
        addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      if (!isRegion(x, y + 1))
        addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      if (!isRegion(x - 1, y)) addEdge({ x, y: y + 1 }, { x, y });
    }
  }

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

    const path = pointsToPath(points);
    if (path) paths.push(path);
  }

  return paths;
}


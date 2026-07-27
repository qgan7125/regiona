import type {
  RasterEdge,
  RasterPoint,
  SharedBoundary,
  VectorSegment,
  VisualRegion,
} from "../../types/project";

interface AssemblyInput {
  width: number;
  height: number;
  labelMap: Uint32Array;
  regions: VisualRegion[];
  regionId: string;
  boundaries: SharedBoundary[];
}

interface ContourComponent {
  rasterPoints: RasterPoint[];
  vectorSegments: VectorSegment[];
}

type OrientedEdge = RasterEdge;

const pointKey = ({ x, y }: RasterPoint) => `${x},${y}`;

const edgeKey = (edge: RasterEdge) => {
  const startKey = pointKey(edge.start);
  const endKey = pointKey(edge.end);
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
};

const pointsEqual = (left: RasterPoint, right: RasterPoint) =>
  left.x === right.x && left.y === right.y;

const direction = (edge: OrientedEdge) => {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
};

function chooseNextEdge(current: OrientedEdge, candidates: OrientedEdge[]) {
  const currentDirection = direction(current);
  const preference = [1, 0, 3, 2];
  return [...candidates].sort((left, right) => {
    const leftTurn = (direction(left) - currentDirection + 4) % 4;
    const rightTurn = (direction(right) - currentDirection + 4) % 4;
    return preference.indexOf(leftTurn) - preference.indexOf(rightTurn);
  })[0];
}

function traceEdges(edges: OrientedEdge[]) {
  const used = new Set<OrientedEdge>();
  const outgoing = new Map<string, OrientedEdge[]>();
  for (const edge of edges) {
    const candidates = outgoing.get(pointKey(edge.start)) ?? [];
    candidates.push(edge);
    outgoing.set(pointKey(edge.start), candidates);
  }

  const contours: OrientedEdge[][] = [];
  for (const firstEdge of edges) {
    if (used.has(firstEdge)) continue;
    const contour = [firstEdge];
    used.add(firstEdge);
    let current = firstEdge;

    while (!pointsEqual(current.end, firstEdge.start)) {
      const next = chooseNextEdge(
        current,
        (outgoing.get(pointKey(current.end)) ?? []).filter(
          (edge) => !used.has(edge),
        ),
      );
      if (!next) return undefined;
      used.add(next);
      contour.push(next);
      current = next;
    }

    contours.push(contour);
  }

  return contours;
}

function findSharedComponents(boundaries: SharedBoundary[]) {
  const components: ContourComponent[] = [];
  for (const boundary of boundaries) {
    if (!boundary.topology.isValid || !boundary.rasterContours) continue;
    boundary.rasterContours.forEach((rasterPoints, index) => {
      const vectorSegments = boundary.vectorContours[index];
      if (rasterPoints.length > 1 && vectorSegments && vectorSegments.length > 0) {
        components.push({ rasterPoints, vectorSegments });
      }
    });
  }
  return components;
}

function matchingDirection(
  contour: OrientedEdge[],
  startIndex: number,
  component: ContourComponent,
) {
  const rasterEdgeCount = component.rasterPoints.length - 1;
  if (rasterEdgeCount > contour.length) return undefined;
  const matches = (reverse: boolean) =>
    Array.from({ length: rasterEdgeCount }).every((_, index) => {
      const edge = contour[(startIndex + index) % contour.length]!;
      const from = reverse
        ? component.rasterPoints[rasterEdgeCount - index]!
        : component.rasterPoints[index]!;
      const to = reverse
        ? component.rasterPoints[rasterEdgeCount - index - 1]!
        : component.rasterPoints[index + 1]!;
      return pointsEqual(edge.start, from) && pointsEqual(edge.end, to);
    });

  if (matches(false)) return false;
  if (matches(true)) return true;
  return undefined;
}

function reverseSegments(segments: VectorSegment[]) {
  return [...segments].reverse().map((segment) =>
    segment.type === "line"
      ? { type: "line" as const, start: segment.end, end: segment.start }
      : {
          type: "cubic-bezier" as const,
          start: segment.end,
          control1: segment.control2,
          control2: segment.control1,
          end: segment.start,
        },
  );
}

const format = (value: number) => Number(value.toFixed(6)).toString();

function appendSegment(commands: string[], segment: VectorSegment) {
  if (segment.type === "cubic-bezier") {
    commands.push(
      `C ${format(segment.control1.x)} ${format(segment.control1.y)} ${format(segment.control2.x)} ${format(segment.control2.y)} ${format(segment.end.x)} ${format(segment.end.y)}`,
    );
    return;
  }
  if (segment.end.y === segment.start.y) commands.push(`H ${format(segment.end.x)}`);
  else if (segment.end.x === segment.start.x) commands.push(`V ${format(segment.end.y)}`);
  else commands.push(`L ${format(segment.end.x)} ${format(segment.end.y)}`);
}

function regionEdges(
  labelMap: Uint32Array,
  width: number,
  height: number,
  regionNumber: number,
) {
  const labelAt = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height
      ? (labelMap[y * width + x] ?? 0)
      : 0;
  const edges: OrientedEdge[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (labelAt(x, y) !== regionNumber) continue;
      if (labelAt(x, y - 1) !== regionNumber)
        edges.push({ start: { x, y }, end: { x: x + 1, y } });
      if (labelAt(x + 1, y) !== regionNumber)
        edges.push({ start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } });
      if (labelAt(x, y + 1) !== regionNumber)
        edges.push({ start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } });
      if (labelAt(x - 1, y) !== regionNumber)
        edges.push({ start: { x, y: y + 1 }, end: { x, y } });
    }
  }
  return edges;
}

function assembleContour(contour: OrientedEdge[], components: ContourComponent[]) {
  const matchingStart = contour.flatMap((_, index) =>
    components
      .map((component) => ({ component, reversed: matchingDirection(contour, index, component) }))
      .filter((match) => match.reversed !== undefined)
      .map((match) => ({ index, component: match.component, reversed: match.reversed! })),
  )[0];
  const startIndex = matchingStart?.index ?? 0;
  const commands = [`M ${format(contour[startIndex]!.start.x)} ${format(contour[startIndex]!.start.y)}`];
  let consumed = 0;

  while (consumed < contour.length) {
    const index = (startIndex + consumed) % contour.length;
    const match = components
      .map((component) => ({ component, reversed: matchingDirection(contour, index, component) }))
      .find((candidate) => candidate.reversed !== undefined);
    if (match) {
      const segments = match.reversed
        ? reverseSegments(match.component.vectorSegments)
        : match.component.vectorSegments;
      appendSegment(commands, segments[0]!);
      for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
        appendSegment(commands, segments[segmentIndex]!);
      }
      consumed += match.component.rasterPoints.length - 1;
      continue;
    }
    appendSegment(commands, { type: "line", ...contour[index]! });
    consumed += 1;
  }

  commands.push("Z");
  return commands.join(" ");
}

/**
 * Builds SVG paths from canonical shared-boundary geometry. Returns undefined
 * when the input cannot be safely assembled, allowing exporters to use the
 * existing deterministic paths instead.
 */
export function assembleSharedRegionPaths(input: AssemblyInput): string[] | undefined {
  if (input.labelMap.length !== input.width * input.height) return undefined;
  const regionNumber = input.regions.findIndex((region) => region.id === input.regionId) + 1;
  if (regionNumber === 0) return undefined;
  if (
    input.boundaries.some(
      (boundary) =>
        (boundary.regionAId === input.regionId ||
          boundary.regionBId === input.regionId) &&
        !boundary.topology.isValid,
    )
  ) {
    return undefined;
  }

  const sharedEdgeKeys = new Set(
    input.boundaries.flatMap((boundary) => boundary.rasterEdges.map(edgeKey)),
  );
  const edges = regionEdges(input.labelMap, input.width, input.height, regionNumber);
  if (edges.length === 0 || !edges.every((edge) => sharedEdgeKeys.has(edgeKey(edge)))) {
    return undefined;
  }
  const contours = traceEdges(edges);
  if (!contours) return undefined;

  const components = findSharedComponents(input.boundaries);
  return contours.map((contour) => assembleContour(contour, components));
}

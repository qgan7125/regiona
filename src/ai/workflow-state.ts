export type AiIntermediateStage = "redraw" | "color" | "line-art" | "upscale";
export type AiWorkflowNodeKind =
  | "start"
  | "analyze"
  | "upscale"
  | "redraw"
  | "line-art"
  | "color"
  | "vector";
export type AiWorkflowNodeStatus = "idle" | "ready" | "running" | "complete" | "stale" | "error";
export type AiWorkflowInputPort = "image" | "line-art";

const intermediateStages = new Set<AiIntermediateStage>(["redraw", "color", "line-art", "upscale"]);
const imageProducingNodeKinds = new Set<AiWorkflowNodeKind>([
  "start",
  "upscale",
  "redraw",
  "line-art",
  "color",
]);
const libraryNodeKinds = new Set<AiWorkflowNodeKind>([
  "analyze",
  "upscale",
  "redraw",
  "line-art",
  "color",
]);
const nodeIdsByKind: Partial<Record<AiWorkflowNodeKind, string>> = {
  analyze: "analyze",
  upscale: "image-scale",
  redraw: "clean-redraw",
  "line-art": "black-line-art",
  color: "colorize-line-art",
};

export interface AiIntermediateImage {
  id: string;
  stage: AiIntermediateStage;
  width: number;
  height: number;
}

export interface AiWorkflowNode {
  id: string;
  kind: AiWorkflowNodeKind;
  status: AiWorkflowNodeStatus;
  revision: number;
}

export interface AiWorkflowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  targetPort: AiWorkflowInputPort;
}

export interface AiWorkflowState {
  originalImageId: string;
  intermediateImages: AiIntermediateImage[];
  workingImageId?: string;
  nodes: AiWorkflowNode[];
  edges: AiWorkflowEdge[];
}

export function createAiWorkflowState(originalImageId: string): AiWorkflowState {
  if (!originalImageId.trim()) throw new Error("An AI workflow requires an original image id.");

  return refreshReadyNodes({
    originalImageId,
    intermediateImages: [],
    nodes: [
      { id: "start", kind: "start", status: "complete", revision: 1 },
      { id: "regiona-vector", kind: "vector", status: "idle", revision: 0 },
    ],
    edges: [
      createEdge("start", "regiona-vector", "image"),
    ],
  });
}

export function addAiWorkflowNode(
  workflow: AiWorkflowState,
  kind: AiWorkflowNodeKind,
): AiWorkflowState {
  if (!libraryNodeKinds.has(kind)) {
    throw new Error("Only library workflow nodes can be added to a workflow.");
  }

  const id = nodeIdsByKind[kind];
  if (!id) throw new Error("The selected workflow node does not have an id.");
  if (workflow.nodes.some((node) => node.id === id)) {
    throw new Error("That workflow node is already on the canvas.");
  }

  return refreshReadyNodes({
    ...workflow,
    nodes: [...workflow.nodes, { id, kind, status: "idle", revision: 0 }],
  });
}

export function removeAiWorkflowNode(
  workflow: AiWorkflowState,
  nodeId: string,
): AiWorkflowState {
  const node = findNode(workflow, nodeId);
  if (!libraryNodeKinds.has(node.kind)) {
    throw new Error("Start and Regiona vector cannot be removed from a workflow.");
  }

  return refreshReadyNodes({
    ...workflow,
    nodes: workflow.nodes.filter((candidate) => candidate.id !== nodeId),
    edges: workflow.edges.filter((edge) => edge.sourceId !== nodeId && edge.targetId !== nodeId),
  });
}

export function disconnectAiWorkflowNodes(
  workflow: AiWorkflowState,
  edgeId: string,
): AiWorkflowState {
  if (!workflow.edges.some((edge) => edge.id === edgeId)) {
    throw new Error("The selected workflow connection does not exist.");
  }

  return refreshReadyNodes({
    ...workflow,
    edges: workflow.edges.filter((edge) => edge.id !== edgeId),
  });
}

export function addAiIntermediateImage(
  workflow: AiWorkflowState,
  image: AiIntermediateImage,
): AiWorkflowState {
  if (!image.id.trim()) {
    throw new Error("An intermediate image requires an id.");
  }
  if (!intermediateStages.has(image.stage)) {
    throw new Error("An intermediate image requires a supported stage.");
  }
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height)
    || image.width < 1 || image.height < 1) {
    throw new Error("An intermediate image requires an id and positive dimensions.");
  }
  if (workflow.intermediateImages.some((candidate) => candidate.id === image.id)) {
    throw new Error("Intermediate image ids must be unique.");
  }

  return {
    ...workflow,
    intermediateImages: [...workflow.intermediateImages, image],
  };
}

export function selectAiWorkingImage(
  workflow: AiWorkflowState,
  imageId: string,
): AiWorkflowState {
  if (!workflow.intermediateImages.some((image) => image.id === imageId)) {
    throw new Error("The selected working image is not an available intermediate image.");
  }

  return { ...workflow, workingImageId: imageId };
}

export function connectAiWorkflowNodes(
  workflow: AiWorkflowState,
  connection: Pick<AiWorkflowEdge, "sourceId" | "targetId" | "targetPort">,
): AiWorkflowState {
  const source = findNode(workflow, connection.sourceId);
  const target = findNode(workflow, connection.targetId);

  if (!imageProducingNodeKinds.has(source.kind)) {
    throw new Error("The selected source does not provide an image output.");
  }
  if (!requiredInputPorts(target.kind).includes(connection.targetPort)) {
    throw new Error("The selected target does not support that input.");
  }
  if (!isCompatibleInput(source.kind, target.kind, connection.targetPort)) {
    throw new Error("The selected image output is incompatible with that input.");
  }
  if (workflow.edges.some((edge) => edge.targetId === target.id && edge.targetPort === connection.targetPort)) {
    throw new Error("That workflow input already has an input source.");
  }
  if (source.id === target.id || hasPath(workflow.edges, target.id, source.id)) {
    throw new Error("Workflow connections cannot create a cycle.");
  }

  return refreshReadyNodes({
    ...workflow,
    edges: [...workflow.edges, createEdge(source.id, target.id, connection.targetPort)],
  });
}

export function beginAiWorkflowNodeRun(
  workflow: AiWorkflowState,
  nodeId: string,
): AiWorkflowState {
  const node = findNode(workflow, nodeId);
  if (node.kind === "start") {
    throw new Error("Start is updated by choosing a new source image.");
  }
  if (!hasCurrentInputs(workflow, node)) {
    throw new Error("This workflow node does not have current inputs.");
  }

  const withStaleDescendants = markCompletedDescendantsStale(workflow, node.id);
  return refreshReadyNodes({
    ...withStaleDescendants,
    nodes: markNodeStatus(withStaleDescendants.nodes, node.id, "running"),
  });
}

export function completeAiWorkflowNodeRun(
  workflow: AiWorkflowState,
  nodeId: string,
): AiWorkflowState {
  const node = findNode(workflow, nodeId);
  if (node.kind !== "start" && !hasCurrentInputs(workflow, node)) {
    throw new Error("This workflow node does not have current inputs.");
  }
  if (node.status !== "ready" && node.status !== "running") {
    throw new Error("Only a ready or running workflow node can complete.");
  }

  return refreshReadyNodes({
    ...workflow,
    nodes: workflow.nodes.map((candidate) => candidate.id === node.id
      ? { ...candidate, status: "complete", revision: candidate.revision + 1 }
      : candidate),
  });
}

export function canUseAiWorkflowNodeAsVectorSource(
  workflow: AiWorkflowState,
  nodeId: string,
): boolean {
  const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
  return Boolean(node && imageProducingNodeKinds.has(node.kind) && node.status === "complete");
}

function createEdge(
  sourceId: string,
  targetId: string,
  targetPort: AiWorkflowInputPort,
): AiWorkflowEdge {
  return {
    id: `${sourceId}:${targetPort}:${targetId}`,
    sourceId,
    targetId,
    targetPort,
  };
}

function findNode(workflow: AiWorkflowState, nodeId: string): AiWorkflowNode {
  const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error("The selected workflow node does not exist.");
  return node;
}

function requiredInputPorts(kind: AiWorkflowNodeKind): AiWorkflowInputPort[] {
  switch (kind) {
    case "analyze":
    case "upscale":
    case "redraw":
    case "line-art":
    case "vector":
      return ["image"];
    case "color":
      return ["line-art"];
    case "start":
      return [];
  }
}

function isCompatibleInput(
  sourceKind: AiWorkflowNodeKind,
  targetKind: AiWorkflowNodeKind,
  targetPort: AiWorkflowInputPort,
): boolean {
  if (targetPort === "line-art") return sourceKind === "line-art";
  return targetKind !== "start";
}

function hasCurrentInputs(workflow: AiWorkflowState, node: AiWorkflowNode): boolean {
  return requiredInputPorts(node.kind).every((port) => {
    const edge = workflow.edges.find((candidate) => candidate.targetId === node.id
      && candidate.targetPort === port);
    if (!edge) return false;
    return findNode(workflow, edge.sourceId).status === "complete";
  });
}

function markCompletedDescendantsStale(workflow: AiWorkflowState, nodeId: string): AiWorkflowState {
  const descendants = collectDescendants(workflow.edges, nodeId);
  if (!descendants.size) return workflow;

  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => descendants.has(node.id) && node.status === "complete"
      ? { ...node, status: "stale" }
      : node),
  };
}

function collectDescendants(edges: AiWorkflowEdge[], nodeId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [nodeId];

  while (queue.length) {
    const sourceId = queue.shift();
    for (const edge of edges) {
      if (edge.sourceId !== sourceId || descendants.has(edge.targetId)) continue;
      descendants.add(edge.targetId);
      queue.push(edge.targetId);
    }
  }

  return descendants;
}

function hasPath(edges: AiWorkflowEdge[], startId: string, destinationId: string): boolean {
  return collectDescendants(edges, startId).has(destinationId);
}

function markNodeStatus(
  nodes: AiWorkflowNode[],
  nodeId: string,
  status: AiWorkflowNodeStatus,
): AiWorkflowNode[] {
  return nodes.map((node) => node.id === nodeId ? { ...node, status } : node);
}

function refreshReadyNodes(workflow: AiWorkflowState): AiWorkflowState {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => {
      if (node.status === "idle" && hasCurrentInputs(workflow, node)) {
        return { ...node, status: "ready" };
      }
      if (node.status === "ready" && !hasCurrentInputs(workflow, node)) {
        return { ...node, status: "idle" };
      }
      return node;
    }),
  };
}

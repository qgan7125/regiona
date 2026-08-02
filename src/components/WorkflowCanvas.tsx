import { useCallback, useEffect, useRef, type ChangeEvent, type DragEvent, type MouseEvent } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import Button from "@mui/material/Button";

import { describeUpscaleCandidate } from "../ai/image-scale";
import {
  connectAiWorkflowNodes,
  disconnectAiWorkflowNodes,
  type AiWorkflowNodeKind,
  type AiWorkflowNodeStatus,
  type AiWorkflowState,
} from "../ai/workflow-state";

import "@xyflow/react/dist/style.css";

interface WorkflowCanvasProps {
  sourceName?: string;
  workflow: Pick<AiWorkflowState, "nodes" | "edges">;
  imageScaleFactor: number;
  nodeStatuses?: Partial<Record<WorkflowNodeId, AiWorkflowNodeStatus | "awaiting-source">>;
  onFile: (file: File) => void;
  onAddNode: (kind: AiWorkflowNodeKind) => void;
  onRemoveNode: (nodeId: WorkflowNodeId) => void;
  onConnectWorkflowNodes: (connection: { sourceId: string; targetId: string; targetPort: "image" | "line-art" }) => void;
  onDisconnectWorkflowNodes: (edgeId: string) => void;
  onOpenEditor: () => void;
  onInspectNode: (nodeId: WorkflowNodeId) => void;
  onRunReadyNodes: () => void;
  onCancelRun: () => void;
  isRunningWorkflow: boolean;
}

export type WorkflowNodeId =
  | "start"
  | "analyze"
  | "image-scale"
  | "clean-redraw"
  | "black-line-art"
  | "colorize-line-art"
  | "regiona-vector";

interface WorkflowNodeDefinition {
  id: WorkflowNodeId;
  kind: AiWorkflowNodeKind;
  title: string;
  detail: string;
  position: XYPosition;
  acceptsInput: boolean;
  providesOutput: boolean;
  canDelete: boolean;
}

interface WorkflowNodeData extends Record<string, unknown> {
  title: string;
  detail: string;
  status: AiWorkflowNodeStatus | "awaiting-source";
  acceptsInput: boolean;
  providesOutput: boolean;
}

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  return (
    <article className={`workflow-node workflow-node--${data.status}`}>
      {data.acceptsInput && <Handle type="target" position={Position.Left} />}
      <strong>{data.title}</strong>
      <span title={data.detail}>{data.detail}</span>
      <small>{data.status.replaceAll("-", " ")}</small>
      {data.providesOutput && <Handle type="source" position={Position.Right} />}
    </article>
  );
}

const nodeTypes = { workflow: WorkflowNode };
const nodeDefinitions: Record<WorkflowNodeId, WorkflowNodeDefinition> = {
  start: {
    id: "start",
    kind: "start",
    title: "Start",
    detail: "Upload source image",
    position: { x: 80, y: 280 },
    acceptsInput: false,
    providesOutput: true,
    canDelete: false,
  },
  analyze: {
    id: "analyze",
    kind: "analyze",
    title: "Analyze",
    detail: "Forensic reverse prompt",
    position: { x: 380, y: 80 },
    acceptsInput: true,
    providesOutput: false,
    canDelete: true,
  },
  "image-scale": {
    id: "image-scale",
    kind: "upscale",
    title: "AI upscale",
    detail: "High-resolution candidate",
    position: { x: 380, y: 180 },
    acceptsInput: true,
    providesOutput: true,
    canDelete: true,
  },
  "clean-redraw": {
    id: "clean-redraw",
    kind: "redraw",
    title: "AI clean redraw",
    detail: "Clean geometry candidate",
    position: { x: 380, y: 280 },
    acceptsInput: true,
    providesOutput: true,
    canDelete: true,
  },
  "black-line-art": {
    id: "black-line-art",
    kind: "line-art",
    title: "Black line art",
    detail: "Black lines on white",
    position: { x: 680, y: 280 },
    acceptsInput: true,
    providesOutput: true,
    canDelete: true,
  },
  "colorize-line-art": {
    id: "colorize-line-art",
    kind: "color",
    title: "Colorize line art",
    detail: "Black line art → limited colors",
    position: { x: 980, y: 280 },
    acceptsInput: true,
    providesOutput: true,
    canDelete: true,
  },
  "regiona-vector": {
    id: "regiona-vector",
    kind: "vector",
    title: "Regiona vector",
    detail: "Quantize, edit, export",
    position: { x: 430, y: 450 },
    acceptsInput: true,
    providesOutput: false,
    canDelete: false,
  },
};
const libraryNodeIds: WorkflowNodeId[] = [
  "analyze",
  "image-scale",
  "clean-redraw",
  "black-line-art",
  "colorize-line-art",
];

function targetPortForNode(nodeId: string): "image" | "line-art" {
  return nodeId === "colorize-line-art" ? "line-art" : "image";
}

function createCanvasNode(
  id: WorkflowNodeId,
  sourceName: string | undefined,
  status: AiWorkflowNodeStatus | "awaiting-source" | undefined,
  imageScaleFactor: number,
  position?: XYPosition,
): Node<WorkflowNodeData> {
  const definition = nodeDefinitions[id];
  const detail = id === "start"
    ? sourceName ?? definition.detail
    : id === "image-scale"
      ? describeUpscaleCandidate(imageScaleFactor)
      : definition.detail;

  return {
    id,
    type: "workflow",
    position: position ?? definition.position,
    deletable: definition.canDelete,
    data: {
      title: definition.title,
      detail,
      status: status ?? "awaiting-source",
      acceptsInput: definition.acceptsInput,
      providesOutput: definition.providesOutput,
    },
  };
}

export function WorkflowCanvas({
  sourceName,
  workflow,
  imageScaleFactor,
  nodeStatuses,
  onFile,
  onAddNode,
  onRemoveNode,
  onConnectWorkflowNodes,
  onDisconnectWorkflowNodes,
  onOpenEditor,
  onInspectNode,
  onRunReadyNodes,
  onCancelRun,
  isRunningWorkflow,
}: WorkflowCanvasProps) {
  const pendingNodePositions = useRef(new Map<WorkflowNodeId, XYPosition>());
  const flowInstanceRef = useRef<ReactFlowInstance<Node<WorkflowNodeData>, Edge> | null>(null);
  const [nodes, setNodes, applyNodeChanges] = useNodesState(
    workflow.nodes.map((node) => createCanvasNode(
      node.id as WorkflowNodeId,
      sourceName,
      nodeStatuses?.[node.id as WorkflowNodeId] ?? (sourceName ? node.status : "awaiting-source"),
      imageScaleFactor,
    )),
  );
  const [edges, setEdges, applyEdgeChanges] = useEdgesState<Edge>(
    workflow.edges.map((edge) => ({ id: edge.id, source: edge.sourceId, target: edge.targetId })),
  );

  useEffect(() => {
    setNodes((current) => {
      const existing = new Map(current.map((node) => [node.id, node]));
      return workflow.nodes.map((node) => {
        const id = node.id as WorkflowNodeId;
        const currentNode = existing.get(id);
        const position = currentNode?.position ?? pendingNodePositions.current.get(id);
        pendingNodePositions.current.delete(id);
        return createCanvasNode(
          id,
          sourceName,
          nodeStatuses?.[id] ?? (sourceName ? node.status : "awaiting-source"),
          imageScaleFactor,
          position,
        );
      });
    });
    setEdges(workflow.edges.map((edge) => ({ id: edge.id, source: edge.sourceId, target: edge.targetId })));
  }, [imageScaleFactor, nodeStatuses, setEdges, setNodes, sourceName, workflow.edges, workflow.nodes]);

  const addNode = useCallback((id: WorkflowNodeId, position?: XYPosition) => {
    const definition = nodeDefinitions[id];
    if (!definition.canDelete || workflow.nodes.some((node) => node.id === id)) return;
    if (position) pendingNodePositions.current.set(id, position);
    onAddNode(definition.kind);
  }, [onAddNode, workflow.nodes]);

  const handleNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges>[0]) => {
    applyNodeChanges(changes);
    for (const change of changes) {
      if (change.type === "remove") onRemoveNode(change.id as WorkflowNodeId);
    }
  }, [applyNodeChanges, onRemoveNode]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof applyEdgeChanges>[0]) => {
    applyEdgeChanges(changes);
    for (const change of changes) {
      if (change.type === "remove") onDisconnectWorkflowNodes(change.id);
    }
  }, [applyEdgeChanges, onDisconnectWorkflowNodes]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return false;
    try {
      connectAiWorkflowNodes(workflow as AiWorkflowState, {
        sourceId: connection.source,
        targetId: connection.target,
        targetPort: targetPortForNode(connection.target),
      });
      return true;
    } catch {
      return false;
    }
  }, [workflow]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !isValidConnection(connection)) return;
    const targetPort = targetPortForNode(connection.target);
    const edge: Edge = {
      ...connection,
      id: `${connection.source}:${targetPort}:${connection.target}`,
    };
    setEdges((current) => addEdge(edge, current));
    onConnectWorkflowNodes({ sourceId: connection.source, targetId: connection.target, targetPort });
  }, [isValidConnection, onConnectWorkflowNodes, setEdges]);

  const handleReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    if (!connection.source || !connection.target) return;
    try {
      const withoutPreviousEdge = disconnectAiWorkflowNodes(workflow as AiWorkflowState, oldEdge.id);
      const targetPort = targetPortForNode(connection.target);
      connectAiWorkflowNodes(withoutPreviousEdge, {
        sourceId: connection.source,
        targetId: connection.target,
        targetPort,
      });
      setEdges((current) => reconnectEdge(oldEdge, connection, current));
      onDisconnectWorkflowNodes(oldEdge.id);
      onConnectWorkflowNodes({ sourceId: connection.source, targetId: connection.target, targetPort });
    } catch {
      // React Flow keeps the existing edge when the new connection is incompatible.
    }
  }, [onConnectWorkflowNodes, onDisconnectWorkflowNodes, setEdges, workflow]);

  const handleNodeClick = useCallback((_event: MouseEvent, node: Node<WorkflowNodeData>) => {
    onInspectNode(node.id as WorkflowNodeId);
  }, [onInspectNode]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, id: WorkflowNodeId) => {
    event.dataTransfer.setData("application/regiona-workflow-node", id);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/regiona-workflow-node") as WorkflowNodeId;
    if (!nodeDefinitions[id]) return;
    const position = flowInstanceRef.current?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) ?? {
      x: event.clientX - 100,
      y: event.clientY - 80,
    };
    addNode(id, position);
  };

  return (
    <main className="workflow-shell" aria-label="Image workflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onNodeClick={handleNodeClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.35}
        maxZoom={1.5}
        onlyRenderVisibleElements
        nodesConnectable
        edgesReconnectable
        edgesFocusable
      >
        <Background gap={20} size={1} />
        <Controls />
        <Panel position="top-left" className="workflow-panel workflow-panel--library">
          <p className="eyebrow">Workflow</p>
          <h1>Build your image path</h1>
          <p>Drag a node onto the canvas, or click one to add it. Connect its handles to define the image path.</p>
          <Button component="label" variant="contained">
            {sourceName ? "Replace source image" : "Upload source image"}
            <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
          </Button>
          <section className="workflow-library" aria-labelledby="workflow-library-title">
            <h2 id="workflow-library-title">Node library</h2>
            {libraryNodeIds.map((id) => {
              const definition = nodeDefinitions[id];
              const added = workflow.nodes.some((node) => node.id === id);
              return (
                <button
                  type="button"
                  key={id}
                  draggable={!added}
                  disabled={added}
                  onClick={() => addNode(id)}
                  onDragStart={(event) => handleDragStart(event, id)}
                >
                  <strong>{definition.title}</strong>
                  <span>{id === "image-scale" ? describeUpscaleCandidate(imageScaleFactor) : definition.detail}</span>
                </button>
              );
            })}
          </section>
        </Panel>
        <Panel position="top-right" className="workflow-panel workflow-panel--actions">
          {isRunningWorkflow ? (
            <Button color="inherit" onClick={onCancelRun} variant="outlined">Cancel current run</Button>
          ) : (
            <Button disabled={!sourceName} onClick={onRunReadyNodes} variant="outlined">Run ready nodes</Button>
          )}
          <Button disabled={!sourceName || isRunningWorkflow} onClick={onOpenEditor} variant="outlined">Run to Regiona vector</Button>
          <Button disabled={!sourceName} onClick={onOpenEditor} variant="contained">Open Regiona editor</Button>
        </Panel>
      </ReactFlow>
    </main>
  );
}

import { useCallback, useEffect, type ChangeEvent, type MouseEvent } from "react";
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
} from "@xyflow/react";
import Button from "@mui/material/Button";

import { createAiWorkflowState, type AiWorkflowNodeStatus } from "../ai/workflow-state";

import "@xyflow/react/dist/style.css";

interface WorkflowCanvasProps {
  sourceName?: string;
  nodeStatuses?: Partial<Record<WorkflowNodeId, AiWorkflowNodeStatus | "awaiting-source">>;
  onFile: (file: File) => void;
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

const initialEdges: Edge[] = [
  { id: "start-analyze", source: "start", target: "analyze" },
  { id: "start-image-scale", source: "start", target: "image-scale" },
  { id: "start-redraw", source: "start", target: "clean-redraw" },
  { id: "start-line-art", source: "start", target: "black-line-art" },
  { id: "line-art-color", source: "black-line-art", target: "colorize-line-art" },
  { id: "start-vector", source: "start", target: "regiona-vector" },
  { id: "line-art-vector", source: "black-line-art", target: "regiona-vector" },
  { id: "color-vector", source: "colorize-line-art", target: "regiona-vector" },
  { id: "image-scale-vector", source: "image-scale", target: "regiona-vector" },
];

function createWorkflowNodes(
  sourceName?: string,
  nodeStatuses?: WorkflowCanvasProps["nodeStatuses"],
): Node<WorkflowNodeData>[] {
  const statuses = new Map<string, AiWorkflowNodeStatus | "awaiting-source">(
    createAiWorkflowState(sourceName ?? "pending-source").nodes
      .map((node) => [node.id, sourceName ? node.status : "awaiting-source"]),
  );
  const node = (
    id: string,
    title: string,
    detail: string,
    x: number,
    y: number,
  ): Node<WorkflowNodeData> => ({
    id,
    type: "workflow",
    position: { x, y },
    deletable: false,
    data: {
      title,
      detail,
      status: nodeStatuses?.[id as WorkflowNodeId] ?? statuses.get(id) ?? "awaiting-source",
      acceptsInput: id !== "start",
      providesOutput: id !== "analyze",
    },
  });

  return [
    node("start", "Start", sourceName ?? "Upload source image", 0, 260),
    node("analyze", "Analyze", "Forensic reverse prompt", 300, 0),
    node("image-scale", "AI upscale", "2× high-resolution candidate", 300, 85),
    node("clean-redraw", "AI clean redraw", "Clean geometry candidate", 300, 170),
    node("black-line-art", "Black line art", "Black lines on white", 300, 340),
    node("colorize-line-art", "Colorize line art", "Black line art → limited colors", 600, 340),
    node("regiona-vector", "Regiona vector", "Quantize, edit, export", 900, 260),
  ];
}

export function WorkflowCanvas({
  sourceName,
  nodeStatuses,
  onFile,
  onOpenEditor,
  onInspectNode,
  onRunReadyNodes,
  onCancelRun,
  isRunningWorkflow,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(createWorkflowNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const updatedNodeData = new Map(
      createWorkflowNodes(sourceName, nodeStatuses).map((node) => [node.id, node.data]),
    );
    setNodes((current) => current.map((node) => ({
      ...node,
      data: updatedNodeData.get(node.id) ?? node.data,
    })));
  }, [nodeStatuses, setNodes, sourceName]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge(connection, current));
  }, [setEdges]);

  const onReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    setEdges((current) => reconnectEdge(oldEdge, connection, current));
  }, [setEdges]);

  const isValidConnection = useCallback((connection: Connection | Edge) => Boolean(
    connection.source
    && connection.target
    && connection.source !== connection.target
    && connection.source !== "analyze"
    && connection.target !== "start",
  ), []);

  const handleNodeClick = useCallback((_event: MouseEvent, node: Node<WorkflowNodeData>) => {
    onInspectNode(node.id as WorkflowNodeId);
  }, [onInspectNode]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  return (
    <main className="workflow-shell" aria-label="Image workflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onNodeClick={handleNodeClick}
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
        <Panel position="top-left" className="workflow-panel">
          <p className="eyebrow">Workflow</p>
          <h1>Build your image path</h1>
          <p>Choose a node to inspect or run it. Only current inputs can continue to vectorization.</p>
          <Button component="label" variant="contained">
            {sourceName ? "Replace source image" : "Upload source image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
          </Button>
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

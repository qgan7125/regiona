import { useMemo, type ChangeEvent } from "react";
import {
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import Button from "@mui/material/Button";

import { createAiWorkflowState, type AiWorkflowNodeStatus } from "../ai/workflow-state";

import "@xyflow/react/dist/style.css";

interface WorkflowCanvasProps {
  sourceName?: string;
  onFile: (file: File) => void;
  onOpenEditor: () => void;
}

interface WorkflowNodeData extends Record<string, unknown> {
  title: string;
  detail: string;
  status: AiWorkflowNodeStatus | "awaiting-source";
}

function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  return (
    <article className={`workflow-node workflow-node--${data.status}`}>
      <Handle type="target" position={Position.Left} />
      <strong>{data.title}</strong>
      <span>{data.detail}</span>
      <small>{data.status.replaceAll("-", " ")}</small>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

const nodeTypes = { workflow: WorkflowNode };

export function WorkflowCanvas({ sourceName, onFile, onOpenEditor }: WorkflowCanvasProps) {
  const nodes = useMemo(() => {
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
      data: { title, detail, status: statuses.get(id) ?? "awaiting-source" },
    });

    return [
      node("start", "Start", sourceName ?? "Upload source image", 0, 260),
      node("analyze", "Analyze", "Quality and vectorization advice", 300, 0),
      node("clean-redraw", "AI clean redraw", "Clean geometry candidate", 300, 170),
      node("black-line-art", "Black line art", "Black lines on white", 300, 340),
      node("apply-source-colors", "Apply source colors", "Clean redraw + original", 600, 170),
      node("regiona-vector", "Regiona vector", "Quantize, edit, export", 900, 260),
    ];
  }, [sourceName]);

  const edges = useMemo(() => [
    { id: "start-analyze", source: "start", target: "analyze" },
    { id: "start-redraw", source: "start", target: "clean-redraw" },
    { id: "start-line-art", source: "start", target: "black-line-art" },
    { id: "start-color", source: "start", target: "apply-source-colors" },
    { id: "redraw-color", source: "clean-redraw", target: "apply-source-colors" },
    { id: "start-vector", source: "start", target: "regiona-vector" },
    { id: "line-art-vector", source: "black-line-art", target: "regiona-vector" },
    { id: "color-vector", source: "apply-source-colors", target: "regiona-vector" },
  ], []);

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
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.35}
        maxZoom={1.5}
        onlyRenderVisibleElements
        nodesConnectable={false}
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
          <Button disabled={!sourceName} variant="outlined">Run ready nodes</Button>
          <Button disabled={!sourceName} variant="outlined">Run to Regiona vector</Button>
          <Button disabled={!sourceName} onClick={onOpenEditor} variant="contained">Open Regiona editor</Button>
        </Panel>
      </ReactFlow>
    </main>
  );
}

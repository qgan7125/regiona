import type { AiWorkflowNodeKind, AiWorkflowState } from "./workflow-state";

export interface WorkflowExecutionStep {
  nodeId: string;
  kind: Exclude<AiWorkflowNodeKind, "start" | "vector">;
  sourceId: string;
}

export function createWorkflowExecutionPlan(workflow: Pick<AiWorkflowState, "nodes" | "edges">) {
  const runnableNodes = workflow.nodes.filter((node): node is typeof node & {
    kind: WorkflowExecutionStep["kind"];
  } => node.kind !== "start" && node.kind !== "vector");
  const pending = new Map(runnableNodes.map((node) => [node.id, node]));
  const availableSources = new Set(["start"]);
  const plan: WorkflowExecutionStep[] = [];

  while (pending.size) {
    const next = [...pending.values()].find((node) => {
      const input = workflow.edges.find((edge) => edge.targetId === node.id);
      return input && availableSources.has(input.sourceId);
    });
    if (!next) break;

    const input = workflow.edges.find((edge) => edge.targetId === next.id);
    if (!input) break;
    plan.push({
      nodeId: next.id,
      kind: next.kind,
      sourceId: input.sourceId,
    });
    pending.delete(next.id);
    if (next.kind !== "analyze") availableSources.add(next.id);
  }

  return plan;
}

export function getWorkflowVectorInputSourceId(workflow: Pick<AiWorkflowState, "edges">) {
  return workflow.edges.find((edge) => edge.targetId === "regiona-vector")?.sourceId;
}

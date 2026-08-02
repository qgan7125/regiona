import type { AiWorkflowInputPort, AiWorkflowNodeKind, AiWorkflowState } from "./workflow-state";

export interface WorkflowExecutionStep {
  nodeId: string;
  kind: Exclude<AiWorkflowNodeKind, "start" | "vector">;
  sourceId: string;
  inputPort: AiWorkflowInputPort;
}

export function createWorkflowExecutionPlan(workflow: Pick<AiWorkflowState, "nodes" | "edges">) {
  const runnableNodes = workflow.nodes.filter((node): node is typeof node & {
    kind: WorkflowExecutionStep["kind"];
  } => node.kind !== "start" && node.kind !== "vector");
  const pending = new Map(runnableNodes.map((node) => [node.id, node]));
  const availableImageSources = new Set(["start"]);
  const availablePromptSources = new Set<string>();
  const plan: WorkflowExecutionStep[] = [];

  while (pending.size) {
    const next = [...pending.values()].find((node) => {
      const input = workflow.edges.find((edge) => edge.targetId === node.id);
      if (!input) return false;
      return input.targetPort === "prompt"
        ? availablePromptSources.has(input.sourceId)
        : availableImageSources.has(input.sourceId);
    });
    if (!next) break;

    const input = workflow.edges.find((edge) => edge.targetId === next.id);
    if (!input) break;
    plan.push({
      nodeId: next.id,
      kind: next.kind,
      sourceId: input.sourceId,
      inputPort: input.targetPort,
    });
    pending.delete(next.id);
    if (next.kind === "analyze") availablePromptSources.add(next.id);
    else availableImageSources.add(next.id);
  }

  return plan;
}

export function getWorkflowVectorInputSourceId(workflow: Pick<AiWorkflowState, "edges">) {
  return workflow.edges.find((edge) => edge.targetId === "regiona-vector")?.sourceId;
}

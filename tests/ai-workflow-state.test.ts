import { describe, expect, it } from "vitest";

import {
  addAiIntermediateImage,
  addAiWorkflowNode,
  beginAiWorkflowNodeRun,
  canUseAiWorkflowNodeAsVectorSource,
  completeAiWorkflowNodeRun,
  connectAiWorkflowNodes,
  createAiWorkflowState,
  disconnectAiWorkflowNodes,
  removeAiWorkflowNode,
  selectAiWorkingImage,
} from "../src/ai/workflow-state";
import { createWorkflowExecutionPlan, getWorkflowVectorInputSourceId } from "../src/ai/workflow-execution";

describe("AI workflow state", () => {
  it("keeps the original reference intact while selecting a redraw as the working image", () => {
    const initial = createAiWorkflowState("original-image");
    const withRedraw = addAiIntermediateImage(initial, {
      id: "clean-redraw",
      stage: "redraw",
      width: 1024,
      height: 1024,
    });

    expect(selectAiWorkingImage(withRedraw, "clean-redraw")).toMatchObject({
      originalImageId: "original-image",
      intermediateImages: [
        { id: "clean-redraw", stage: "redraw", width: 1024, height: 1024 },
      ],
      workingImageId: "clean-redraw",
    });
  });

  it("does not allow a missing intermediate image to become the working image", () => {
    expect(() => selectAiWorkingImage(createAiWorkflowState("original-image"), "missing"))
      .toThrow("working image");
  });

  it("rejects malformed intermediate image references", () => {
    expect(() => addAiIntermediateImage(createAiWorkflowState("original-image"), {
      id: "",
      stage: "redraw",
      width: 1024,
      height: 1024,
    })).toThrow("intermediate image");
  });

  it("rejects invalid stages and dimensions from a provider response", () => {
    expect(() => addAiIntermediateImage(createAiWorkflowState("original-image"), {
      id: "invalid-stage",
      stage: "other" as "redraw",
      width: 1024,
      height: 1024,
    })).toThrow("stage");

    expect(() => addAiIntermediateImage(createAiWorkflowState("original-image"), {
      id: "invalid-size",
      stage: "redraw",
      width: Number.NaN,
      height: 1024,
    })).toThrow("dimensions");
  });

  it("starts with only a direct Start to Regiona vector path", () => {
    const workflow = createAiWorkflowState("original-image");

    expect(workflow.nodes.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "start", status: "complete" },
      { id: "regiona-vector", status: "ready" },
    ]);
    expect(workflow.edges).toEqual([
      expect.objectContaining({ sourceId: "start", targetId: "regiona-vector", targetPort: "image" }),
    ]);
  });

  it("lets users compose an upscale to line-art to color path", () => {
    let workflow = createAiWorkflowState("original-image");
    workflow = addAiWorkflowNode(workflow, "upscale");
    workflow = addAiWorkflowNode(workflow, "line-art");
    workflow = addAiWorkflowNode(workflow, "color");
    workflow = disconnectAiWorkflowNodes(workflow, "start:image:regiona-vector");
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "start",
      targetId: "image-scale",
      targetPort: "image",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "image-scale",
      targetId: "black-line-art",
      targetPort: "image",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "black-line-art",
      targetId: "colorize-line-art",
      targetPort: "line-art",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "colorize-line-art",
      targetId: "regiona-vector",
      targetPort: "image",
    });

    expect(workflow.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "image-scale", targetId: "black-line-art" }),
      expect.objectContaining({ sourceId: "black-line-art", targetId: "colorize-line-art" }),
      expect.objectContaining({ sourceId: "colorize-line-art", targetId: "regiona-vector" }),
    ]));
    expect(canUseAiWorkflowNodeAsVectorSource(
      completeAiWorkflowNodeRun(workflow, "image-scale"),
      "image-scale",
    )).toBe(true);
    expect(createWorkflowExecutionPlan(workflow)).toEqual([
      { nodeId: "image-scale", kind: "upscale", sourceId: "start", inputPort: "image" },
      { nodeId: "black-line-art", kind: "line-art", sourceId: "image-scale", inputPort: "image" },
      { nodeId: "colorize-line-art", kind: "color", sourceId: "black-line-art", inputPort: "line-art" },
    ]);
    expect(getWorkflowVectorInputSourceId(workflow)).toBe("colorize-line-art");
  });

  it("allows an Analyze result to feed a prompt-only redraw node", () => {
    let workflow = createAiWorkflowState("original-image");
    workflow = addAiWorkflowNode(workflow, "analyze");
    workflow = addAiWorkflowNode(workflow, "prompt-redraw");
    workflow = disconnectAiWorkflowNodes(workflow, "start:image:regiona-vector");
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "start",
      targetId: "analyze",
      targetPort: "image",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "analyze",
      targetId: "prompt-redraw",
      targetPort: "prompt",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "prompt-redraw",
      targetId: "regiona-vector",
      targetPort: "image",
    });

    expect(createWorkflowExecutionPlan(workflow)).toEqual([
      { nodeId: "analyze", kind: "analyze", sourceId: "start", inputPort: "image" },
      { nodeId: "prompt-redraw", kind: "prompt-redraw", sourceId: "analyze", inputPort: "prompt" },
    ]);
    expect(getWorkflowVectorInputSourceId(workflow)).toBe("prompt-redraw");
  });

  it("removes a library node with every connection that belongs to it", () => {
    let workflow = addAiWorkflowNode(createAiWorkflowState("original-image"), "analyze");
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "start",
      targetId: "analyze",
      targetPort: "image",
    });

    expect(removeAiWorkflowNode(workflow, "analyze")).toMatchObject({
      nodes: expect.not.arrayContaining([expect.objectContaining({ id: "analyze" })]),
      edges: expect.not.arrayContaining([expect.objectContaining({ targetId: "analyze" })]),
    });
  });

  it("rejects incompatible workflow connections and duplicate input sources", () => {
    let workflow = createAiWorkflowState("original-image");
    workflow = addAiWorkflowNode(workflow, "analyze");
    workflow = addAiWorkflowNode(workflow, "redraw");

    expect(() => connectAiWorkflowNodes(workflow, {
      sourceId: "analyze",
      targetId: "regiona-vector",
      targetPort: "image",
    })).toThrow("image output");

    expect(() => connectAiWorkflowNodes(workflow, {
      sourceId: "clean-redraw",
      targetId: "regiona-vector",
      targetPort: "image",
    })).toThrow("already has an input");
  });

  it("marks only completed descendants stale when black line art is rerun", () => {
    let workflow = createAiWorkflowState("original-image");
    workflow = addAiWorkflowNode(workflow, "analyze");
    workflow = addAiWorkflowNode(workflow, "line-art");
    workflow = addAiWorkflowNode(workflow, "color");
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "start",
      targetId: "analyze",
      targetPort: "image",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "start",
      targetId: "black-line-art",
      targetPort: "image",
    });
    workflow = connectAiWorkflowNodes(workflow, {
      sourceId: "black-line-art",
      targetId: "colorize-line-art",
      targetPort: "line-art",
    });
    workflow = completeAiWorkflowNodeRun(workflow, "black-line-art");
    workflow = completeAiWorkflowNodeRun(workflow, "colorize-line-art");
    workflow = completeAiWorkflowNodeRun(workflow, "analyze");

    workflow = beginAiWorkflowNodeRun(workflow, "black-line-art");

    expect(workflow.nodes.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "start", status: "complete" },
      { id: "regiona-vector", status: "ready" },
      { id: "analyze", status: "complete" },
      { id: "black-line-art", status: "running" },
      { id: "colorize-line-art", status: "stale" },
    ]);
    expect(canUseAiWorkflowNodeAsVectorSource(workflow, "colorize-line-art")).toBe(false);
  });
});

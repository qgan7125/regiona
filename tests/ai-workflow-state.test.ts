import { describe, expect, it } from "vitest";

import {
  addAiIntermediateImage,
  beginAiWorkflowNodeRun,
  canUseAiWorkflowNodeAsVectorSource,
  completeAiWorkflowNodeRun,
  connectAiWorkflowNodes,
  createAiWorkflowState,
  selectAiWorkingImage,
} from "../src/ai/workflow-state";

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

  it("creates a ready fan-out from Start while waiting for line art before colorization", () => {
    const workflow = createAiWorkflowState("original-image");

    expect(workflow.nodes.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "start", status: "complete" },
      { id: "analyze", status: "ready" },
      { id: "image-scale", status: "ready" },
      { id: "clean-redraw", status: "ready" },
      { id: "black-line-art", status: "ready" },
      { id: "colorize-line-art", status: "idle" },
      { id: "regiona-vector", status: "ready" },
    ]);
    expect(workflow.edges.filter((edge) => edge.targetId === "colorize-line-art"))
      .toEqual([expect.objectContaining({ sourceId: "black-line-art", targetPort: "line-art" })]);
  });

  it("treats the image scale node as an image-producing workflow branch", () => {
    const workflow = createAiWorkflowState("original-image");

    expect(workflow.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "start", targetId: "image-scale", targetPort: "image" }),
    ]));
    expect(canUseAiWorkflowNodeAsVectorSource(
      completeAiWorkflowNodeRun(workflow, "image-scale"),
      "image-scale",
    )).toBe(true);
  });

  it("rejects incompatible workflow connections and duplicate input sources", () => {
    const workflow = createAiWorkflowState("original-image");

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
    workflow = completeAiWorkflowNodeRun(workflow, "black-line-art");
    workflow = completeAiWorkflowNodeRun(workflow, "colorize-line-art");
    workflow = completeAiWorkflowNodeRun(workflow, "analyze");

    workflow = beginAiWorkflowNodeRun(workflow, "black-line-art");

    expect(workflow.nodes.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "start", status: "complete" },
      { id: "analyze", status: "complete" },
      { id: "image-scale", status: "ready" },
      { id: "clean-redraw", status: "ready" },
      { id: "black-line-art", status: "running" },
      { id: "colorize-line-art", status: "stale" },
      { id: "regiona-vector", status: "ready" },
    ]);
    expect(canUseAiWorkflowNodeAsVectorSource(workflow, "colorize-line-art")).toBe(false);
  });
});

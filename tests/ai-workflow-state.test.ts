import { describe, expect, it } from "vitest";

import {
  addAiIntermediateImage,
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

    expect(selectAiWorkingImage(withRedraw, "clean-redraw")).toEqual({
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
});

export type AiIntermediateStage = "redraw" | "color";

const intermediateStages = new Set<AiIntermediateStage>(["redraw", "color"]);

export interface AiIntermediateImage {
  id: string;
  stage: AiIntermediateStage;
  width: number;
  height: number;
}

export interface AiWorkflowState {
  originalImageId: string;
  intermediateImages: AiIntermediateImage[];
  workingImageId?: string;
}

export function createAiWorkflowState(originalImageId: string): AiWorkflowState {
  return {
    originalImageId,
    intermediateImages: [],
  };
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

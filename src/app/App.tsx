import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createImageFileFromGeneratedImage,
  type AiGeneratedImage,
} from "../ai/openai-image-provider";
import { createGeminiImageProvider } from "../ai/gemini-image-provider";
import { createGeminiAnalysisProvider } from "../ai/gemini-analysis-provider";
import { calculateUpscaleDimensions, resizeAiGeneratedImage } from "../ai/image-scale";
import { loadGeminiApiKey } from "../ai/gemini-key-store";
import type { AiStructureAnalysis } from "../ai/structure-analysis";
import {
  addAiWorkflowNode,
  connectAiWorkflowNodes,
  createAiWorkflowState,
  disconnectAiWorkflowNodes,
  removeAiWorkflowNode,
  type AiWorkflowNodeKind,
  type AiWorkflowNodeStatus,
} from "../ai/workflow-state";
import { createWorkflowExecutionPlan, getWorkflowVectorInputSourceId } from "../ai/workflow-execution";
import { AppHeader } from "../components/AppHeader";
import { Inspector } from "../components/Inspector";
import { GeminiSettingsDialog } from "../components/GeminiSettingsDialog";
import { PreviewWorkspace } from "../components/PreviewWorkspace";
import { UploadPanel } from "../components/UploadPanel";
import { WorkflowCanvas } from "../components/WorkflowCanvas";
import { WorkflowInspector } from "../components/WorkflowInspector";
import { VectorSourceConfirmationDialog } from "../components/VectorSourceConfirmationDialog";
import type { WorkflowNodeId } from "../components/WorkflowCanvas";
import { appendColorHistory, redoColorEdit, undoColorEdit } from "./editor-state";
import { appendPickedColor } from "./palette-suggestions";
import {
  appendSelectionHistory,
  prependSelectionFuture,
  redoSelectionEdit,
  undoSelectionEdit,
} from "./selection-state";
import { mergeSameFillRegions, recolorRegions, renderRegionPixels } from "../engine/reconstruct";
import {
  maximumAreaForSimplification,
  simplificationLabel,
  type RegionSimplification,
} from "../engine/regions/simplification";
import type { ColorSample } from "../preview/color-sample";
import type { ReconstructionResult } from "../types/project";
import { decodeImage } from "../utils/image-file";
import {
  exportRegionaSvg,
} from "../utils/project-export";
import { ReconstructionWorkerClient } from "../workers/worker-client";

type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";
type AppMode = "choose" | "direct" | "workflow";
type AiGenerationStage = "analysis" | "scale" | "redraw" | "line-art" | "color";
const MAX_GENERATED_IMAGE_BYTES = 64 * 1024 * 1024;

interface SourceState {
  file: File;
  filename: string;
  url: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  pixels: Uint8ClampedArray;
}

interface WorkflowImageInput {
  file: File;
  width: number;
  height: number;
}

async function createSourceState(
  file: File,
  options?: { maximumFileBytes?: number },
): Promise<SourceState> {
  const decoded = await decodeImage(file, options);
  return {
    file,
    filename: file.name,
    url: URL.createObjectURL(file),
    originalWidth: decoded.originalWidth,
    originalHeight: decoded.originalHeight,
    processedWidth: decoded.width,
    processedHeight: decoded.height,
    pixels: decoded.pixels,
  };
}

async function createWorkflowImageInput(
  image: AiGeneratedImage,
  label: string,
): Promise<WorkflowImageInput> {
  const extension = image.mimeType === "image/jpeg" ? "jpg" : "png";
  const file = createImageFileFromGeneratedImage(image, `regiona-${label}.${extension}`);
  const bitmap = await createImageBitmap(file);
  try {
    return { file, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export function App() {
  const workerRef = useRef<ReconstructionWorkerClient | null>(null);
  const processingRequestRef = useRef(0);
  const processingStartedAtRef = useRef(0);
  const workflowRunIdRef = useRef(0);
  const [targetColors, setTargetColors] = useState(12);
  const [mode, setMode] = useState<AppMode>("choose");
  const [appliedTargetColors, setAppliedTargetColors] = useState(12);
  const [regionSimplification, setRegionSimplification] = useState<RegionSimplification>("off");
  const [appliedRegionSimplification, setAppliedRegionSimplification] = useState<RegionSimplification>("off");
  const [despeckleEnabled, setDespeckleEnabled] = useState(false);
  const [appliedDespeckleEnabled, setAppliedDespeckleEnabled] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [source, setSource] = useState<SourceState>();
  const [workflowSource, setWorkflowSource] = useState<SourceState>();
  const [workflow, setWorkflow] = useState(() => createAiWorkflowState("pending-source"));
  const [result, setResult] = useState<ReconstructionResult>();
  const [colorHistory, setColorHistory] = useState<
    ReconstructionResult[]
  >([]);
  const [colorFuture, setColorFuture] = useState<
    ReconstructionResult[]
  >([]);
  const [pickedColors, setPickedColors] = useState<ColorSample[]>([]);
  const [isRecoloring, setIsRecoloring] = useState(false);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const selectedRegionIdsRef = useRef<string[]>([]);
  const [selectionHistory, setSelectionHistory] = useState<string[][]>([]);
  const [selectionFuture, setSelectionFuture] = useState<string[][]>([]);
  const [status, setStatus] = useState<WorkStatus>("idle");
  const [statusText, setStatusText] = useState("Ready for a source image");
  const [error, setError] = useState<string>();
  const [isGeminiSettingsOpen, setIsGeminiSettingsOpen] = useState(false);
  const [cleanRedraw, setCleanRedraw] = useState<AiGeneratedImage>();
  const [imageScale, setImageScale] = useState<AiGeneratedImage>();
  const [imageScaleFactor, setImageScaleFactor] = useState(2);
  const [lineArt, setLineArt] = useState<AiGeneratedImage>();
  const [colorizedLineArt, setColorizedLineArt] = useState<AiGeneratedImage>();
  const [lineArtColorCount, setLineArtColorCount] = useState(12);
  const [analysis, setAnalysis] = useState<AiStructureAnalysis>();
  const [aiError, setAiError] = useState<string>();
  const [aiGenerationStage, setAiGenerationStage] = useState<AiGenerationStage>();
  const [workflowInspectorNodeId, setWorkflowInspectorNodeId] = useState<WorkflowNodeId>();
  const [pendingVectorCandidate, setPendingVectorCandidate] = useState<{
    image: AiGeneratedImage;
    label: string;
  }>();
  const [isWorkflowRunActive, setIsWorkflowRunActive] = useState(false);

  useEffect(() => {
    const worker = new ReconstructionWorkerClient();
    workerRef.current = worker;
    return () => {
      workerRef.current = null;
      worker.dispose();
    };
  }, []);
  useEffect(
    () => () => {
      if (source?.url) URL.revokeObjectURL(source.url);
    },
    [source?.url],
  );
  useEffect(
    () => () => {
      if (workflowSource?.url) URL.revokeObjectURL(workflowSource.url);
    },
    [workflowSource?.url],
  );

  const localBusy = status === "decoding" || status === "processing";
  const busy = localBusy || Boolean(aiGenerationStage);

  const resetSelectionHistory = useCallback(() => {
    selectedRegionIdsRef.current = [];
    setSelectedRegionIds([]);
    setSelectionHistory([]);
    setSelectionFuture([]);
  }, []);

  const updateSelectedRegions = useCallback((nextSelection: SetStateAction<string[]>) => {
    const previousSelection = selectedRegionIdsRef.current;
    const resolvedSelection = typeof nextSelection === "function"
      ? nextSelection(previousSelection)
      : nextSelection;
    if (!appendSelectionHistory([], previousSelection, resolvedSelection).length) return;

    selectedRegionIdsRef.current = resolvedSelection;
    setSelectedRegionIds(resolvedSelection);
    setSelectionHistory((history) => appendSelectionHistory(
      history,
      previousSelection,
      resolvedSelection,
    ));
    setSelectionFuture([]);
  }, []);

  useEffect(() => {
    if (!source) return;

    const tinyRegionMaximumArea = maximumAreaForSimplification(
      appliedRegionSimplification,
      source.processedWidth,
      source.processedHeight,
    );

    let isCurrent = true;
    const requestId = processingRequestRef.current + 1;
    processingRequestRef.current = requestId;

    const timer = window.setTimeout(() => {
      processingStartedAtRef.current = performance.now();
      setStatus("processing");
      setStatusText(
        `Building ${appliedTargetColors}-color visual regions${tinyRegionMaximumArea ? ` · ${simplificationLabel(appliedRegionSimplification).toLowerCase()} simplification` : ""}`,
      );
      void (async () => {
        try {
          const worker = workerRef.current;
          if (!worker) {
            throw new Error("The reconstruction worker is not ready.");
          }
          const pixelBuffer = source.pixels.buffer.slice(
            source.pixels.byteOffset,
            source.pixels.byteOffset + source.pixels.byteLength,
          ) as ArrayBuffer;
          const reconstruction = await worker.processImage(
            {
              pixels: pixelBuffer,
              width: source.processedWidth,
              height: source.processedHeight,
              targetColors: appliedTargetColors,
              tinyRegionMaximumArea,
              despeckleEnabled: appliedDespeckleEnabled,
              sourceFilename: source.filename,
            },
            (_progress, stage) => {
              if (isCurrent) setStatusText(stage);
            },
          );
          if (!isCurrent || processingRequestRef.current !== requestId) return;

          setResult(reconstruction);
          resetSelectionHistory();
          setStatus("ready");
          const processingDuration = performance.now() - processingStartedAtRef.current;
          const processingTime = processingDuration >= 1000
            ? `${(processingDuration / 1000).toFixed(1)}s`
            : `${Math.round(processingDuration)}ms`;
          setStatusText(
            `${reconstruction.regions.length.toLocaleString()} regions ready · ${processingTime}`,
          );
        } catch (cause) {
          if (!isCurrent || processingRequestRef.current !== requestId) return;
          setStatus("error");
          setStatusText("Reconstruction failed");
          setError(
            cause instanceof Error ? cause.message : "Image processing failed.",
          );
        }
      })();
    }, 180);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [
    appliedDespeckleEnabled,
    appliedRegionSimplification,
    appliedTargetColors,
    generation,
    resetSelectionHistory,
    source,
  ]);

  const handleFile = async (file: File) => {
    workflowRunIdRef.current += 1;
    setIsWorkflowRunActive(false);
    setAiGenerationStage(undefined);
    setError(undefined);
    setStatus("decoding");
    setStatusText("Decoding locally");

    try {
      const nextSource = await createSourceState(file);
      setSource(nextSource);
      setWorkflowSource({ ...nextSource, url: URL.createObjectURL(file) });
      setAppliedTargetColors(targetColors);
      setAppliedRegionSimplification(regionSimplification);
      setAppliedDespeckleEnabled(despeckleEnabled);
      setGeneration((current) => current + 1);
      setResult(undefined);
      setColorHistory([]);
      setColorFuture([]);
      setPickedColors([]);
      resetSelectionHistory();
      setCleanRedraw(undefined);
      setImageScale(undefined);
      setLineArt(undefined);
      setColorizedLineArt(undefined);
      setAnalysis(undefined);
      setAiError(undefined);
    } catch (cause) {
      setStatus("error");
      setStatusText("Import failed");
      setError(cause instanceof Error ? cause.message : "Image import failed.");
    }
  };

  const recolorSelectedRegions = (regionIds: string[], fill: string) => {
    if (!result) return;
    const recoloredRegions = recolorRegions(result.regions, regionIds, fill);
    if (recoloredRegions === result.regions) return;
    const recoloredResult = {
      ...result,
      regions: recoloredRegions,
      quantizedPixels: renderRegionPixels(result.labelMap, recoloredRegions),
    };
    const nextHistory = appendColorHistory(
      colorHistory,
      result,
      recoloredResult,
    );
    if (nextHistory === colorHistory) return;

    setIsRecoloring(true);
    window.requestAnimationFrame(() => {
      setColorHistory(nextHistory);
      setColorFuture([]);
      setResult(recoloredResult);
      window.requestAnimationFrame(() => setIsRecoloring(false));
    });
  };

  const handleRecolor = (fill: string) => {
    if (!selectedRegionIds.length) return;
    recolorSelectedRegions(selectedRegionIds, fill);
  };

  const handleMergeSelectedRegions = () => {
    if (!result || selectedRegionIds.length < 2) return;

    try {
      const nextResult = mergeSameFillRegions(result, selectedRegionIds);
      const mergedRegionId = result.regions.find((region) => selectedRegionIds.includes(region.id))?.id;
      setResult(nextResult);
      setColorHistory((history) => appendColorHistory(history, result, nextResult));
      setColorFuture([]);
      setSelectionHistory([]);
      setSelectionFuture([]);
      selectedRegionIdsRef.current = mergedRegionId ? [mergedRegionId] : [];
      setSelectedRegionIds(selectedRegionIdsRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not merge the selected SVG regions.");
    }
  };

  const handleUndoColor = useCallback(() => {
    if (!result) return;
    const previous = undoColorEdit(result, colorHistory);
    if (previous.result === result) return;

    setColorHistory(previous.history);
    setColorFuture((current) => [result, ...current].slice(0, 50));
    setResult(previous.result);
  }, [colorHistory, result]);

  const handleRedoColor = useCallback(() => {
    if (!result) return;
    const next = redoColorEdit(result, colorFuture);
    if (next.result === result) return;

    setColorHistory((current) => appendColorHistory(current, result, next.result));
    setColorFuture(next.future);
    setResult(next.result);
  }, [colorFuture, result]);

  const handleUndoSelection = useCallback(() => {
    const currentSelection = selectedRegionIdsRef.current;
    const previous = undoSelectionEdit(currentSelection, selectionHistory);
    if (previous.selection === currentSelection) return;

    setSelectionHistory(previous.history);
    setSelectionFuture((future) => prependSelectionFuture(future, currentSelection));
    selectedRegionIdsRef.current = previous.selection;
    setSelectedRegionIds(previous.selection);
  }, [selectionHistory]);

  const handleRedoSelection = useCallback(() => {
    const currentSelection = selectedRegionIdsRef.current;
    const next = redoSelectionEdit(currentSelection, selectionFuture);
    if (next.selection === currentSelection) return;

    setSelectionHistory((current) => appendSelectionHistory(
      current,
      currentSelection,
      next.selection,
    ));
    setSelectionFuture(next.future);
    selectedRegionIdsRef.current = next.selection;
    setSelectedRegionIds(next.selection);
  }, [selectionFuture]);

  const handleRegenerate = () => {
    if (!source || busy) return;
    setResult(undefined);
    setColorHistory([]);
    setColorFuture([]);
    setPickedColors([]);
    resetSelectionHistory();
    setStatus("processing");
    const tinyRegionMaximumArea = maximumAreaForSimplification(
      regionSimplification,
      source.processedWidth,
      source.processedHeight,
    );
    setStatusText(
      `Rebuilding ${targetColors}-color visual regions${tinyRegionMaximumArea ? ` · ${simplificationLabel(regionSimplification).toLowerCase()} simplification` : ""}`,
    );
    setAppliedTargetColors(targetColors);
    setAppliedRegionSimplification(regionSimplification);
    setAppliedDespeckleEnabled(despeckleEnabled);
    setGeneration((current) => current + 1);
  };

  const handleUseWorkflowCandidate = async () => {
    const candidate = pendingVectorCandidate;
    if (!candidate) return;

    setPendingVectorCandidate(undefined);
    setStatus("decoding");
    setStatusText(`Preparing ${candidate.label.toLowerCase()} for Regiona`);

    try {
      const extension = candidate.image.mimeType === "image/jpeg" ? "jpg" : "png";
      const nextSource = await createSourceState(
        createImageFileFromGeneratedImage(candidate.image, `regiona-${candidate.label.toLowerCase().replaceAll(" ", "-")}.${extension}`),
        { maximumFileBytes: MAX_GENERATED_IMAGE_BYTES },
      );
      setSource(nextSource);
      setAppliedTargetColors(targetColors);
      setAppliedRegionSimplification(regionSimplification);
      setAppliedDespeckleEnabled(despeckleEnabled);
      setGeneration((current) => current + 1);
      setResult(undefined);
      setColorHistory([]);
      setColorFuture([]);
      setPickedColors([]);
      resetSelectionHistory();
      setError(undefined);
      setMode("direct");
    } catch (cause) {
      setStatus("error");
      setStatusText("Could not use this candidate");
      setError(cause instanceof Error ? cause.message : "Could not prepare the selected image.");
    }
  };

  const handleRunReadyWorkflowNodes = async () => {
    const inputSource = workflowSource ?? source;
    if (!inputSource || busy || isWorkflowRunActive) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before running workflow tasks.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    const plan = createWorkflowExecutionPlan(workflow);
    if (!plan.length) {
      setAiError("Connect at least one AI node to Start before running the workflow.");
      return;
    }

    const runId = workflowRunIdRef.current + 1;
    workflowRunIdRef.current = runId;
    const isCurrentRun = () => workflowRunIdRef.current === runId;
    setAiError(undefined);
    setIsWorkflowRunActive(true);

    try {
      const imageProvider = createGeminiImageProvider(apiKey);
      const analysisProvider = createGeminiAnalysisProvider(apiKey);
      const outputs = new Map<string, AiGeneratedImage>();
      if (imageScale) outputs.set("image-scale", imageScale);
      if (cleanRedraw) outputs.set("clean-redraw", cleanRedraw);
      if (lineArt) outputs.set("black-line-art", lineArt);
      if (colorizedLineArt) outputs.set("colorize-line-art", colorizedLineArt);
      const inputs = new Map<string, WorkflowImageInput>([
        ["start", {
          file: inputSource.file,
          width: inputSource.originalWidth,
          height: inputSource.originalHeight,
        }],
      ]);

      for (const step of plan) {
        if (step.kind === "analyze" && analysis) continue;
        const input = inputs.get(step.sourceId)
          ?? (outputs.get(step.sourceId)
            ? await createWorkflowImageInput(outputs.get(step.sourceId)!, step.sourceId)
            : undefined);
        if (!input) {
          throw new Error(`Run ${step.sourceId} before ${step.nodeId}.`);
        }
        if (!inputs.has(step.sourceId)) inputs.set(step.sourceId, input);

        if (step.kind === "analyze") {
          setAiGenerationStage("analysis");
          const generatedAnalysis = await analysisProvider.analyzeImage({ source: input.file });
          if (!isCurrentRun()) return;
          setAnalysis(generatedAnalysis);
          continue;
        }
        if (outputs.has(step.nodeId)) {
          inputs.set(step.nodeId, await createWorkflowImageInput(outputs.get(step.nodeId)!, step.nodeId));
          continue;
        }

        if (step.kind === "upscale") {
          setAiGenerationStage("scale");
          const dimensions = calculateUpscaleDimensions({
            width: input.width,
            height: input.height,
            scale: imageScaleFactor,
          });
          const generated = await imageProvider.improveImageScale({ source: input.file, scale: imageScaleFactor });
          if (!isCurrentRun()) return;
          const resized = await resizeAiGeneratedImage(generated, dimensions);
          if (!isCurrentRun()) return;
          outputs.set(step.nodeId, resized);
          inputs.set(step.nodeId, await createWorkflowImageInput(resized, step.nodeId));
          setImageScale(resized);
          continue;
        }
        if (step.kind === "redraw") {
          setAiGenerationStage("redraw");
          const generated = await imageProvider.createCleanRedraw({ source: input.file });
          if (!isCurrentRun()) return;
          outputs.set(step.nodeId, generated);
          inputs.set(step.nodeId, await createWorkflowImageInput(generated, step.nodeId));
          setCleanRedraw(generated);
          continue;
        }
        if (step.kind === "line-art") {
          setAiGenerationStage("line-art");
          const generated = await imageProvider.createLineArt({ source: input.file });
          if (!isCurrentRun()) return;
          outputs.set(step.nodeId, generated);
          inputs.set(step.nodeId, await createWorkflowImageInput(generated, step.nodeId));
          setLineArt(generated);
          continue;
        }

        setAiGenerationStage("color");
        const generated = await imageProvider.colorizeLineArt({
          original: inputSource.file,
          lineArt: input.file,
          colorCount: lineArtColorCount,
        });
        if (!isCurrentRun()) return;
        outputs.set(step.nodeId, generated);
        inputs.set(step.nodeId, await createWorkflowImageInput(generated, step.nodeId));
        setColorizedLineArt(generated);
      }
    } catch (cause) {
      if (isCurrentRun()) {
        setAiError(cause instanceof Error ? cause.message : "Could not complete the workflow run. Please try again.");
      }
    } finally {
      if (isCurrentRun()) {
        setAiGenerationStage(undefined);
        setIsWorkflowRunActive(false);
      }
    }
  };

  const handleCancelWorkflowRun = () => {
    if (!isWorkflowRunActive) return;
    workflowRunIdRef.current += 1;
    setAiGenerationStage(undefined);
    setIsWorkflowRunActive(false);
    setStatusText("Workflow run cancelled");
  };

  const handleAddWorkflowNode = useCallback((kind: AiWorkflowNodeKind) => {
    setWorkflow((current) => addAiWorkflowNode(current, kind));
  }, []);

  const handleRemoveWorkflowNode = useCallback((nodeId: WorkflowNodeId) => {
    setWorkflow((current) => removeAiWorkflowNode(current, nodeId));
    setWorkflowInspectorNodeId((current) => current === nodeId ? undefined : current);
  }, []);

  const handleConnectWorkflowNodes = useCallback((connection: {
    sourceId: string;
    targetId: string;
    targetPort: "image" | "line-art";
  }) => {
    setWorkflow((current) => connectAiWorkflowNodes(current, connection));
  }, []);

  const handleDisconnectWorkflowNodes = useCallback((edgeId: string) => {
    setWorkflow((current) => disconnectAiWorkflowNodes(current, edgeId));
  }, []);

  const handleOpenWorkflowEditor = useCallback(() => {
    const sourceId = getWorkflowVectorInputSourceId(workflow);
    if (!sourceId) {
      setAiError("Connect an image node to Regiona vector before opening the editor.");
      return;
    }
    if (sourceId === "start") {
      setMode("direct");
      return;
    }

    const candidates: Record<string, { image: AiGeneratedImage | undefined; label: string }> = {
      "image-scale": { image: imageScale, label: "AI upscale" },
      "clean-redraw": { image: cleanRedraw, label: "AI clean redraw" },
      "black-line-art": { image: lineArt, label: "Black line art" },
      "colorize-line-art": { image: colorizedLineArt, label: "Colorized line art" },
    };
    const candidate = candidates[sourceId];
    if (!candidate?.image) {
      setAiError("Run the image connected to Regiona vector before opening the editor.");
      return;
    }
    setPendingVectorCandidate({ image: candidate.image, label: candidate.label });
  }, [cleanRedraw, colorizedLineArt, imageScale, lineArt, workflow]);

  const handleGenerateCleanRedraw = async () => {
    const inputSource = mode === "workflow" ? workflowSource ?? source : source;
    if (!inputSource || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before generating a clean redraw.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("redraw");
    try {
      const provider = createGeminiImageProvider(apiKey);
      const generated = await provider.createCleanRedraw({
        source: inputSource.file,
      });
      setCleanRedraw(generated);
    } catch (cause) {
      setAiError(
        cause instanceof Error
          ? cause.message
          : "Could not generate a clean redraw. Please try again.",
      );
    } finally {
      setAiGenerationStage(undefined);
    }
  };

  const handleImproveImageScale = async () => {
    const inputSource = mode === "workflow" ? workflowSource ?? source : source;
    if (!inputSource || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before upscaling this image.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("scale");
    try {
      const provider = createGeminiImageProvider(apiKey);
      const upscaleDimensions = calculateUpscaleDimensions({
        width: inputSource.originalWidth,
        height: inputSource.originalHeight,
        scale: imageScaleFactor,
      });
      const generated = await provider.improveImageScale({
        source: inputSource.file,
        scale: imageScaleFactor,
      });
      setImageScale(await resizeAiGeneratedImage(generated, upscaleDimensions));
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : "Could not create a high-resolution image. Please try again.");
    } finally {
      setAiGenerationStage(undefined);
    }
  };

  const handleGenerateLineArt = async () => {
    const inputSource = mode === "workflow" ? workflowSource ?? source : source;
    if (!inputSource || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before generating black line art.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("line-art");
    try {
      const provider = createGeminiImageProvider(apiKey);
      setLineArt(await provider.createLineArt({ source: inputSource.file }));
      setColorizedLineArt(undefined);
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : "Could not generate black line art. Please try again.");
    } finally {
      setAiGenerationStage(undefined);
    }
  };

  const handleAnalyzeImage = async () => {
    const inputSource = mode === "workflow" ? workflowSource ?? source : source;
    if (!inputSource || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before analyzing this image.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("analysis");
    try {
      const provider = createGeminiAnalysisProvider(apiKey);
      setAnalysis(await provider.analyzeImage({ source: inputSource.file }));
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : "Could not analyze this image. Please try again.");
    } finally {
      setAiGenerationStage(undefined);
    }
  };

  const handleColorizeLineArt = async () => {
    const inputSource = mode === "workflow" ? workflowSource ?? source : source;
    if (!inputSource || !lineArt || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before colorizing line art.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("color");
    try {
      const provider = createGeminiImageProvider(apiKey);
      const generated = await provider.colorizeLineArt({
        original: inputSource.file,
        lineArt: createImageFileFromGeneratedImage(
          lineArt,
          `regiona-black-line-art.${lineArt.mimeType === "image/jpeg" ? "jpg" : "png"}`,
        ),
        colorCount: lineArtColorCount,
      });
      setColorizedLineArt(generated);
    } catch (cause) {
      setAiError(
        cause instanceof Error
          ? cause.message
          : "Could not colorize line art. Please try again.",
      );
    } finally {
      setAiGenerationStage(undefined);
    }
  };

  const workflowNodeStatuses = useMemo(() => {
    const statuses: Partial<Record<WorkflowNodeId, AiWorkflowNodeStatus | "awaiting-source">> = {};
    const currentWorkflowSource = workflowSource ?? source;
    if (!currentWorkflowSource) {
      for (const node of workflow.nodes) {
        statuses[node.id as WorkflowNodeId] = "awaiting-source";
      }
      return statuses;
    }

    const completed = new Set<string>(["start"]);
    if (analysis) completed.add("analyze");
    if (imageScale) completed.add("image-scale");
    if (cleanRedraw) completed.add("clean-redraw");
    if (lineArt) completed.add("black-line-art");
    if (colorizedLineArt) completed.add("colorize-line-art");

    const runningNodeByStage: Partial<Record<AiGenerationStage, WorkflowNodeId>> = {
      analysis: "analyze",
      scale: "image-scale",
      redraw: "clean-redraw",
      "line-art": "black-line-art",
      color: "colorize-line-art",
    };
    const runningNodeId = aiGenerationStage ? runningNodeByStage[aiGenerationStage] : undefined;

    for (const node of workflow.nodes) {
      const id = node.id as WorkflowNodeId;
      if (id === "start") {
        statuses[id] = "complete";
        continue;
      }
      if (id === runningNodeId) {
        statuses[id] = "running";
        continue;
      }
      if (completed.has(id)) {
        statuses[id] = "complete";
        continue;
      }
      const input = workflow.edges.find((edge) => edge.targetId === id);
      statuses[id] = input && completed.has(input.sourceId) ? "ready" : "idle";
    }

    return statuses;
  }, [aiGenerationStage, analysis, cleanRedraw, colorizedLineArt, imageScale, lineArt, source, workflow, workflowSource]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.altKey && !(event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
        const shouldRedoSelection = key === "y" || (key === "z" && event.shiftKey);
        if (shouldRedoSelection ? !selectionFuture.length : !selectionHistory.length) return;
        event.preventDefault();
        if (shouldRedoSelection) handleRedoSelection();
        else handleUndoSelection();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const shouldRedo = key === "y" || (key === "z" && event.shiftKey);
      if (key !== "z" && key !== "y") {
        return;
      }
      const action = shouldRedo ? handleRedoColor : handleUndoColor;
      if (shouldRedo ? !colorFuture.length : !colorHistory.length) return;
      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    colorFuture.length,
    colorHistory.length,
    handleRedoColor,
    handleRedoSelection,
    handleUndoColor,
    handleUndoSelection,
    selectionFuture.length,
    selectionHistory.length,
  ]);

  return (
    <div className="app-shell">
      <AppHeader
        status={aiGenerationStage ? "processing" : status}
        statusText={aiGenerationStage === "color"
          ? "Colorizing black line art from the source image"
          : aiGenerationStage === "scale"
            ? "Creating a high-resolution image candidate"
          : aiGenerationStage === "line-art"
            ? "Generating black line art"
            : aiGenerationStage === "analysis"
              ? "Analyzing image structure"
          : aiGenerationStage === "redraw"
            ? "Generating AI clean redraw"
            : statusText}
        activeView={mode}
        onGoHome={() => setMode("choose")}
        onOpenEditor={() => setMode("direct")}
        onOpenWorkflow={() => {
          setWorkflowInspectorNodeId(undefined);
          setMode("workflow");
        }}
        onOpenSettings={() => setIsGeminiSettingsOpen(true)}
      />
      {isGeminiSettingsOpen ? (
        <GeminiSettingsDialog
          open
          onClose={() => setIsGeminiSettingsOpen(false)}
        />
      ) : null}

      {error ? (
        <div className="error-banner" role="alert">
          <strong>Couldn’t process that image.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setError(undefined)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {mode === "choose" ? (
        <main className="mode-choice">
          <p className="eyebrow">Choose a path</p>
          <h1>Start from the image, or build the process.</h1>
          <div>
            <button type="button" onClick={() => setMode("direct")}>
              <strong>Start with Regiona</strong>
              <span>Upload an image and go straight to quantization, regions, and vector editing.</span>
            </button>
            <button type="button" onClick={() => setMode("workflow")}>
              <strong>Build a workflow</strong>
              <span>Branch into analysis, redraw, line art, and color reconstruction before vectorizing.</span>
            </button>
          </div>
        </main>
      ) : mode === "workflow" ? (
        <>
          <WorkflowCanvas
            imageScaleFactor={imageScaleFactor}
            isRunningWorkflow={isWorkflowRunActive}
            nodeStatuses={workflowNodeStatuses}
            sourceName={(workflowSource ?? source)?.filename}
            workflow={workflow}
            onFile={(file) => void handleFile(file)}
            onAddNode={handleAddWorkflowNode}
            onCancelRun={handleCancelWorkflowRun}
            onConnectWorkflowNodes={handleConnectWorkflowNodes}
            onDisconnectWorkflowNodes={handleDisconnectWorkflowNodes}
            onInspectNode={setWorkflowInspectorNodeId}
            onOpenEditor={handleOpenWorkflowEditor}
            onRemoveNode={handleRemoveWorkflowNode}
            onRunReadyNodes={() => void handleRunReadyWorkflowNodes()}
          />
          <WorkflowInspector
            analysis={analysis}
            imageScale={imageScale}
            imageScaleFactor={imageScaleFactor}
            cleanRedraw={cleanRedraw}
            colorCount={lineArtColorCount}
            colorizedLineArt={colorizedLineArt}
            error={aiError}
            lineArt={lineArt}
            nodeId={workflowInspectorNodeId}
            runningStage={aiGenerationStage}
            source={workflowSource ?? source ? {
              filename: (workflowSource ?? source)!.filename,
              url: (workflowSource ?? source)!.url,
              originalWidth: (workflowSource ?? source)!.originalWidth,
              originalHeight: (workflowSource ?? source)!.originalHeight,
              mimeType: (workflowSource ?? source)!.file.type,
            } : undefined}
            onClose={() => setWorkflowInspectorNodeId(undefined)}
            onFile={(file) => void handleFile(file)}
            onOpenEditor={() => setMode("direct")}
            onRunAnalyze={() => void handleAnalyzeImage()}
            onRunImageScale={() => void handleImproveImageScale()}
            onImageScaleFactorChange={(scale) => {
              setImageScaleFactor(scale);
              setImageScale(undefined);
            }}
            onRunCleanRedraw={() => void handleGenerateCleanRedraw()}
            onRunColorizeLineArt={() => void handleColorizeLineArt()}
            onRunLineArt={() => void handleGenerateLineArt()}
            onColorCountChange={(colorCount) => {
              setLineArtColorCount(colorCount);
              setColorizedLineArt(undefined);
            }}
            onUseInRegionaVector={(image, label) => {
              setWorkflowInspectorNodeId(undefined);
              setPendingVectorCandidate({ image, label });
            }}
          />
        </>
      ) : <div className="editor-grid">
        <UploadPanel
          source={
            source
              ? {
                  filename: source.filename,
                  originalWidth: source.originalWidth,
                  originalHeight: source.originalHeight,
                  processedWidth: source.processedWidth,
                  processedHeight: source.processedHeight,
                }
              : undefined
          }
          targetColors={targetColors}
          regionSimplification={regionSimplification}
          tinyRegionMaximumArea={source
            ? maximumAreaForSimplification(
                regionSimplification,
                source.processedWidth,
                source.processedHeight,
              )
            : 0}
          despeckleEnabled={despeckleEnabled}
          palette={result?.palette ?? []}
          regionCount={result?.regions.length ?? 0}
          busy={busy}
          onTargetColorsChange={setTargetColors}
          onRegionSimplificationChange={setRegionSimplification}
          onDespeckleEnabledChange={setDespeckleEnabled}
          onRegenerate={handleRegenerate}
          onFile={handleFile}
        />
        <PreviewWorkspace
          originalPixels={source?.pixels}
          result={result}
          busy={busy || isRecoloring}
          pickedColors={pickedColors}
          selectedRegionIds={selectedRegionIds}
          canUndoSelection={Boolean(result && selectionHistory.length)}
          canRedoSelection={Boolean(result && selectionFuture.length)}
          onSelectRegions={updateSelectedRegions}
          onUndoSelection={handleUndoSelection}
          onRedoSelection={handleRedoSelection}
          onPickColor={(color) => {
            setPickedColors((current) => appendPickedColor(current, color));
          }}
          onRecolorRegions={recolorSelectedRegions}
        />
        <Inspector
          regions={result?.regions ?? []}
          palette={result?.palette ?? []}
          busy={busy || isRecoloring}
          selectedRegionIds={selectedRegionIds}
          canUndoColor={Boolean(result && colorHistory.length)}
          canRedoColor={Boolean(result && colorFuture.length)}
          onSelectRegions={updateSelectedRegions}
          onRecolor={handleRecolor}
          onMergeSelected={handleMergeSelectedRegions}
          onUndoColor={handleUndoColor}
          onRedoColor={handleRedoColor}
          canExportSvg={Boolean(result)}
          onExportSvg={() => {
            if (result) exportRegionaSvg(result);
          }}
        />
      </div>}
      <VectorSourceConfirmationDialog
        candidate={pendingVectorCandidate}
        onCancel={() => setPendingVectorCandidate(undefined)}
        onConfirm={() => void handleUseWorkflowCandidate()}
      />
    </div>
  );
}

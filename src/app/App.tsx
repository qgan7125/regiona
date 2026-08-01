import { type SetStateAction, useCallback, useEffect, useRef, useState } from "react";

import {
  createImageFileFromGeneratedImage,
  type AiGeneratedImage,
} from "../ai/openai-image-provider";
import { createGeminiImageProvider } from "../ai/gemini-image-provider";
import { loadGeminiApiKey } from "../ai/gemini-key-store";
import { AppHeader } from "../components/AppHeader";
import { Inspector } from "../components/Inspector";
import { GeminiSettingsDialog } from "../components/GeminiSettingsDialog";
import { PreviewWorkspace } from "../components/PreviewWorkspace";
import { UploadPanel } from "../components/UploadPanel";
import { WorkflowCanvas } from "../components/WorkflowCanvas";
import { appendColorHistory, redoColorEdit, undoColorEdit } from "./editor-state";
import { appendPickedColor } from "./palette-suggestions";
import {
  appendSelectionHistory,
  prependSelectionFuture,
  redoSelectionEdit,
  undoSelectionEdit,
} from "./selection-state";
import { recolorRegions } from "../engine/reconstruct";
import {
  maximumAreaForSimplification,
  simplificationLabel,
  type RegionSimplification,
} from "../engine/regions/simplification";
import type { ColorSample } from "../preview/color-sample";
import type { ReconstructionResult } from "../types/project";
import { decodeImage } from "../utils/image-file";
import {
  exportRegionaProject,
  exportRegionaSvg,
} from "../utils/project-export";
import { ReconstructionWorkerClient } from "../workers/worker-client";

type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";
type AppMode = "choose" | "direct" | "workflow";

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

export function App() {
  const workerRef = useRef<ReconstructionWorkerClient | null>(null);
  const processingRequestRef = useRef(0);
  const processingStartedAtRef = useRef(0);
  const [targetColors, setTargetColors] = useState(12);
  const [mode, setMode] = useState<AppMode>("choose");
  const [appliedTargetColors, setAppliedTargetColors] = useState(12);
  const [regionSimplification, setRegionSimplification] = useState<RegionSimplification>("off");
  const [appliedRegionSimplification, setAppliedRegionSimplification] = useState<RegionSimplification>("off");
  const [despeckleEnabled, setDespeckleEnabled] = useState(false);
  const [appliedDespeckleEnabled, setAppliedDespeckleEnabled] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [source, setSource] = useState<SourceState>();
  const [result, setResult] = useState<ReconstructionResult>();
  const [colorHistory, setColorHistory] = useState<
    ReconstructionResult["regions"][]
  >([]);
  const [colorFuture, setColorFuture] = useState<
    ReconstructionResult["regions"][]
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
  const [colorReconstruction, setColorReconstruction] = useState<AiGeneratedImage>();
  const [aiError, setAiError] = useState<string>();
  const [aiGenerationStage, setAiGenerationStage] = useState<"redraw" | "color">();

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
    setError(undefined);
    setStatus("decoding");
    setStatusText("Decoding locally");

    try {
      const decoded = await decodeImage(file);
      const url = URL.createObjectURL(file);
      setSource({
        file,
        filename: file.name,
        url,
        originalWidth: decoded.originalWidth,
        originalHeight: decoded.originalHeight,
        processedWidth: decoded.width,
        processedHeight: decoded.height,
        pixels: decoded.pixels,
      });
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
      setColorReconstruction(undefined);
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
    const nextHistory = appendColorHistory(
      colorHistory,
      result.regions,
      recoloredRegions,
    );
    if (nextHistory === colorHistory) return;

    setIsRecoloring(true);
    window.requestAnimationFrame(() => {
      setColorHistory(nextHistory);
      setColorFuture([]);
      setResult({ ...result, regions: recoloredRegions });
      window.requestAnimationFrame(() => setIsRecoloring(false));
    });
  };

  const handleRecolor = (fill: string) => {
    if (!selectedRegionIds.length) return;
    recolorSelectedRegions(selectedRegionIds, fill);
  };

  const handleUndoColor = useCallback(() => {
    if (!result) return;
    const previous = undoColorEdit(result.regions, colorHistory);
    if (previous.regions === result.regions) return;

    setColorHistory(previous.history);
    setColorFuture((current) => [result.regions, ...current].slice(0, 50));
    setResult({ ...result, regions: previous.regions });
  }, [colorHistory, result]);

  const handleRedoColor = useCallback(() => {
    if (!result) return;
    const next = redoColorEdit(result.regions, colorFuture);
    if (next.regions === result.regions) return;

    setColorHistory((current) => appendColorHistory(current, result.regions, next.regions));
    setColorFuture(next.future);
    setResult({ ...result, regions: next.regions });
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

  const handleGenerateCleanRedraw = async () => {
    if (!source || busy) return;

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
        source: source.file,
      });
      setCleanRedraw(generated);
      setColorReconstruction(undefined);
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

  const handleReconstructColors = async () => {
    if (!source || !cleanRedraw || busy) return;

    const { apiKey } = loadGeminiApiKey();
    if (!apiKey) {
      setAiError("Add your Gemini API key in settings before reconstructing colors.");
      setIsGeminiSettingsOpen(true);
      return;
    }

    setAiError(undefined);
    setAiGenerationStage("color");
    try {
      const provider = createGeminiImageProvider(apiKey);
      const generated = await provider.reconstructColors({
        original: source.file,
        cleanRedraw: createImageFileFromGeneratedImage(
          cleanRedraw,
          `regiona-clean-redraw.${cleanRedraw.mimeType === "image/jpeg" ? "jpg" : "png"}`,
        ),
        palette: result?.palette.map((color) => color.hex),
      });
      setColorReconstruction(generated);
    } catch (cause) {
      setAiError(
        cause instanceof Error
          ? cause.message
          : "Could not reconstruct colors. Please try again.",
      );
    } finally {
      setAiGenerationStage(undefined);
    }
  };

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
          ? "Applying original colors to AI redraw"
          : aiGenerationStage === "redraw"
            ? "Generating AI clean redraw"
            : statusText}
        canExport={Boolean(result)}
        onOpenSettings={() => setIsGeminiSettingsOpen(true)}
        onExportProject={() => {
          if (result) exportRegionaProject(result);
        }}
        onExportSvg={() => {
          if (result) exportRegionaSvg(result);
        }}
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
        <WorkflowCanvas
          sourceName={source?.filename}
          onFile={(file) => void handleFile(file)}
          onOpenEditor={() => setMode("direct")}
        />
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
          cleanRedraw={cleanRedraw}
          colorReconstruction={colorReconstruction}
          aiGenerationStage={aiGenerationStage}
          aiError={aiError}
          onTargetColorsChange={setTargetColors}
          onRegionSimplificationChange={setRegionSimplification}
          onDespeckleEnabledChange={setDespeckleEnabled}
          onRegenerate={handleRegenerate}
          onFile={handleFile}
          onGenerateCleanRedraw={() => void handleGenerateCleanRedraw()}
          onReconstructColors={() => void handleReconstructColors()}
          onOpenGeminiSettings={() => setIsGeminiSettingsOpen(true)}
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
          onUndoColor={handleUndoColor}
          onRedoColor={handleRedoColor}
        />
      </div>}
    </div>
  );
}

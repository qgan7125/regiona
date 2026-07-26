import { useCallback, useEffect, useRef, useState } from "react";

import { AppHeader } from "../components/AppHeader";
import { Inspector } from "../components/Inspector";
import { PreviewWorkspace } from "../components/PreviewWorkspace";
import { UploadPanel } from "../components/UploadPanel";
import { appendColorHistory, undoColorEdit } from "./editor-state";
import { appendPickedColor } from "./palette-suggestions";
import { recolorRegion } from "../engine/reconstruct";
import type { ColorSample } from "../preview/color-sample";
import type { ReconstructionResult } from "../types/project";
import { decodeImage } from "../utils/image-file";
import {
  exportRegionaProject,
  exportRegionaSvg,
} from "../utils/project-export";
import { ReconstructionWorkerClient } from "../workers/worker-client";

type WorkStatus = "idle" | "decoding" | "processing" | "ready" | "error";

interface SourceState {
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
  const [targetColors, setTargetColors] = useState(12);
  const [appliedTargetColors, setAppliedTargetColors] = useState(12);
  const [generation, setGeneration] = useState(0);
  const [source, setSource] = useState<SourceState>();
  const [result, setResult] = useState<ReconstructionResult>();
  const [colorHistory, setColorHistory] = useState<
    ReconstructionResult["regions"][]
  >([]);
  const [pickedColors, setPickedColors] = useState<ColorSample[]>([]);
  const [isRecoloring, setIsRecoloring] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState<string>();
  const [status, setStatus] = useState<WorkStatus>("idle");
  const [statusText, setStatusText] = useState("Ready for a source image");
  const [error, setError] = useState<string>();

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

  const busy = status === "decoding" || status === "processing";

  useEffect(() => {
    if (!source) return;

    let isCurrent = true;
    const requestId = processingRequestRef.current + 1;
    processingRequestRef.current = requestId;

    const timer = window.setTimeout(() => {
      setStatus("processing");
      setStatusText(`Building ${appliedTargetColors}-color visual regions`);
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
              sourceFilename: source.filename,
            },
            (_progress, stage) => {
              if (isCurrent) setStatusText(stage);
            },
          );
          if (!isCurrent || processingRequestRef.current !== requestId) return;

          setResult(reconstruction);
          setSelectedRegionId(undefined);
          setStatus("ready");
          setStatusText(
            `${reconstruction.regions.length.toLocaleString()} regions ready`,
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
  }, [appliedTargetColors, generation, source]);

  const handleFile = async (file: File) => {
    setError(undefined);
    setStatus("decoding");
    setStatusText("Decoding locally");

    try {
      const decoded = await decodeImage(file);
      const url = URL.createObjectURL(file);
      setSource({
        filename: file.name,
        url,
        originalWidth: decoded.originalWidth,
        originalHeight: decoded.originalHeight,
        processedWidth: decoded.width,
        processedHeight: decoded.height,
        pixels: decoded.pixels,
      });
      setAppliedTargetColors(targetColors);
      setGeneration((current) => current + 1);
      setResult(undefined);
      setColorHistory([]);
      setPickedColors([]);
      setSelectedRegionId(undefined);
    } catch (cause) {
      setStatus("error");
      setStatusText("Import failed");
      setError(cause instanceof Error ? cause.message : "Image import failed.");
    }
  };

  const recolorSelectedRegion = (regionId: string, fill: string) => {
    if (!result) return;
    const recoloredRegions = recolorRegion(
      result.regions,
      regionId,
      fill,
    );
    const nextHistory = appendColorHistory(
      colorHistory,
      result.regions,
      recoloredRegions,
    );
    if (nextHistory === colorHistory) return;

    setIsRecoloring(true);
    window.requestAnimationFrame(() => {
      setColorHistory(nextHistory);
      setResult({ ...result, regions: recoloredRegions });
      window.requestAnimationFrame(() => setIsRecoloring(false));
    });
  };

  const handleRecolor = (fill: string) => {
    if (!selectedRegionId) return;
    recolorSelectedRegion(selectedRegionId, fill);
  };

  const handleUndoColor = useCallback(() => {
    if (!result) return;
    const previous = undoColorEdit(result.regions, colorHistory);
    if (previous.regions === result.regions) return;

    setColorHistory(previous.history);
    setResult({ ...result, regions: previous.regions });
  }, [colorHistory, result]);

  const handleRegenerate = () => {
    if (!source || busy) return;
    setResult(undefined);
    setColorHistory([]);
    setPickedColors([]);
    setSelectedRegionId(undefined);
    setStatus("processing");
    setStatusText(`Rebuilding ${targetColors}-color visual regions`);
    setAppliedTargetColors(targetColors);
    setGeneration((current) => current + 1);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      if (!colorHistory.length) return;
      event.preventDefault();
      handleUndoColor();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [colorHistory.length, handleUndoColor]);

  return (
    <div className="app-shell">
      <AppHeader
        status={status}
        statusText={statusText}
        canExport={Boolean(result)}
        canUndo={Boolean(result && colorHistory.length)}
        onUndoColor={handleUndoColor}
        onExportProject={() => {
          if (result) exportRegionaProject(result);
        }}
        onExportSvg={() => {
          if (result) exportRegionaSvg(result);
        }}
      />

      {error ? (
        <div className="error-banner" role="alert">
          <strong>Couldn’t process that image.</strong>
          <span>{error}</span>
          <button type="button" onClick={() => setError(undefined)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="editor-grid">
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
          palette={result?.palette ?? []}
          regionCount={result?.regions.length ?? 0}
          busy={busy}
          onTargetColorsChange={setTargetColors}
          onRegenerate={handleRegenerate}
          onFile={handleFile}
        />
        <PreviewWorkspace
          originalPixels={source?.pixels}
          result={result}
          busy={busy || isRecoloring}
          pickedColors={pickedColors}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
          onPickColor={(color) => {
            setPickedColors((current) => appendPickedColor(current, color));
          }}
          onRecolorRegion={recolorSelectedRegion}
        />
        <Inspector
          regions={result?.regions ?? []}
          palette={result?.palette ?? []}
          busy={busy || isRecoloring}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
          onRecolor={handleRecolor}
        />
      </div>
    </div>
  );
}

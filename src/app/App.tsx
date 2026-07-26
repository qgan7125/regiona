import { useEffect, useRef, useState } from "react";

import { AppHeader } from "../components/AppHeader";
import { Inspector } from "../components/Inspector";
import { PreviewWorkspace } from "../components/PreviewWorkspace";
import { UploadPanel } from "../components/UploadPanel";
import { recolorRegion } from "../engine/reconstruct";
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
}

export function App() {
  const workerRef = useRef<ReconstructionWorkerClient | null>(null);
  const [targetColors, setTargetColors] = useState(12);
  const [source, setSource] = useState<SourceState>();
  const [result, setResult] = useState<ReconstructionResult>();
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

  const handleFile = async (file: File) => {
    setError(undefined);
    setStatus("decoding");
    setStatusText("Decoding locally");

    try {
      const worker = workerRef.current;
      if (!worker) throw new Error("The reconstruction worker is not ready.");
      const decoded = await decodeImage(file);
      const url = URL.createObjectURL(file);
      setSource({
        filename: file.name,
        url,
        originalWidth: decoded.originalWidth,
        originalHeight: decoded.originalHeight,
        processedWidth: decoded.width,
        processedHeight: decoded.height,
      });
      setResult(undefined);
      setSelectedRegionId(undefined);
      setStatus("processing");
      setStatusText("Building visual regions");

      const pixelBuffer = decoded.pixels.buffer.slice(
        decoded.pixels.byteOffset,
        decoded.pixels.byteOffset + decoded.pixels.byteLength,
      ) as ArrayBuffer;
      const reconstruction = await worker.processImage(
        {
          pixels: pixelBuffer,
          width: decoded.width,
          height: decoded.height,
          targetColors,
          sourceFilename: file.name,
        },
        (_progress, stage) => setStatusText(stage),
      );
      const largestRegion = reconstruction.regions.reduce<
        (typeof reconstruction.regions)[number] | undefined
      >(
        (largest, region) =>
          !largest || region.pixelArea > largest.pixelArea ? region : largest,
        undefined,
      );

      setResult(reconstruction);
      setSelectedRegionId(largestRegion?.id);
      setStatus("ready");
      setStatusText(
        `${reconstruction.regions.length.toLocaleString()} regions ready`,
      );
    } catch (cause) {
      setStatus("error");
      setStatusText("Import failed");
      setError(cause instanceof Error ? cause.message : "Image import failed.");
    }
  };

  return (
    <div className="app-shell">
      <AppHeader
        status={status}
        statusText={statusText}
        canExport={Boolean(result)}
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
          onFile={handleFile}
        />
        <PreviewWorkspace
          sourceUrl={source?.url}
          result={result}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
        />
        <Inspector
          regions={result?.regions ?? []}
          selectedRegionId={selectedRegionId}
          onSelectRegion={setSelectedRegionId}
          onRecolor={(fill) => {
            if (!selectedRegionId) return;
            setResult((current) =>
              current
                ? {
                    ...current,
                    regions: recolorRegion(
                      current.regions,
                      selectedRegionId,
                      fill,
                    ),
                  }
                : current,
            );
          }}
        />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

import { renderRegionPixels } from "../engine/reconstruct";
import type { ReconstructionResult } from "../types/project";

type PreviewView = "original" | "quantized" | "regions" | "vector";

interface PreviewWorkspaceProps {
  sourceUrl?: string;
  result?: ReconstructionResult;
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
}

interface PixelCanvasProps {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  labelMap?: Uint32Array;
  onSelectRegion?: (regionNumber: number) => void;
}

function PixelCanvas({
  pixels,
  width,
  height,
  labelMap,
  onSelectRegion,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.width = width;
    canvas.height = height;
    const imagePixels = new Uint8ClampedArray(pixels.length);
    imagePixels.set(pixels);
    context.putImageData(new ImageData(imagePixels, width, height), 0, 0);
  }, [height, pixels, width]);

  return (
    <canvas
      ref={canvasRef}
      className="stage-media pixelated-preview"
      aria-label="Reconstructed region preview. Use the region list to select with a keyboard."
      onClick={(event) => {
        if (!labelMap || !onSelectRegion) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.min(
          width - 1,
          Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * width)),
        );
        const y = Math.min(
          height - 1,
          Math.max(
            0,
            Math.floor(((event.clientY - bounds.top) / bounds.height) * height),
          ),
        );
        const regionNumber = labelMap[y * width + x] ?? 0;
        if (regionNumber) onSelectRegion(regionNumber);
      }}
    />
  );
}

export function PreviewWorkspace({
  sourceUrl,
  result,
  selectedRegionId,
  onSelectRegion,
}: PreviewWorkspaceProps) {
  const [view, setView] = useState<PreviewView>("regions");
  const regionPixels = useMemo(
    () =>
      result ? renderRegionPixels(result.labelMap, result.regions) : undefined,
    [result],
  );

  return (
    <main className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-toolbar">
        <div>
          <p className="eyebrow">Preview</p>
          <h1 id="workspace-title">
            {result ? result.sourceFilename : "Start with a raster image"}
          </h1>
        </div>
        <div className="view-tabs" role="tablist" aria-label="Preview mode">
          {(["original", "quantized", "regions", "vector"] as const).map(
            (option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                disabled={!result}
                onClick={() => setView(option)}
              >
                {option}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="preview-stage">
        {!result ? (
          <div className="stage-empty">
            <span aria-hidden="true">R</span>
            <h2>Regions, not traces.</h2>
            <p>
              Upload artwork to reduce its palette, separate connected regions,
              and produce independently editable SVG paths.
            </p>
          </div>
        ) : null}

        {result && view === "original" && sourceUrl ? (
          <img className="stage-media" src={sourceUrl} alt="Original uploaded artwork" />
        ) : null}

        {result && view === "quantized" ? (
          <PixelCanvas
            pixels={result.quantizedPixels}
            width={result.width}
            height={result.height}
          />
        ) : null}

        {result && view === "regions" && regionPixels ? (
          <div className="canvas-stack">
            <PixelCanvas
              pixels={regionPixels}
              width={result.width}
              height={result.height}
              labelMap={result.labelMap}
              onSelectRegion={(regionNumber) => {
                const region = result.regions[regionNumber - 1];
                if (region) onSelectRegion(region.id);
              }}
            />
            {selectedRegionId ? (
              <svg
                className="selection-overlay"
                viewBox={`0 0 ${result.width} ${result.height}`}
                aria-hidden="true"
              >
                <path
                  d={
                    result.regions
                      .find((region) => region.id === selectedRegionId)
                      ?.pathData.join(" ") ?? ""
                  }
                />
              </svg>
            ) : null}
          </div>
        ) : null}

        {result && view === "vector" ? (
          <svg
            className="stage-media vector-preview"
            viewBox={`0 0 ${result.width} ${result.height}`}
            role="img"
            aria-label="Editable vector region preview"
          >
            {result.regions.map((region) => (
              <path
                key={region.id}
                d={region.pathData.join(" ")}
                fill={region.fill}
                opacity={region.opacity}
                fillRule="evenodd"
                className={region.id === selectedRegionId ? "is-selected" : ""}
                onClick={() => onSelectRegion(region.id)}
              />
            ))}
          </svg>
        ) : null}
      </div>

      <footer className="workspace-footer">
        <span>Local processing</span>
        <span aria-hidden="true">·</span>
        <span>{result ? `${result.width} × ${result.height}` : "No image loaded"}</span>
        <span aria-hidden="true">·</span>
        <span>{result ? `${result.regions.length} independent regions` : "Phase 1"}</span>
      </footer>
    </main>
  );
}

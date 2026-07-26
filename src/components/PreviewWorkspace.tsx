import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { renderRegionPixels } from "../engine/reconstruct";
import type { ReconstructionResult } from "../types/project";

type PreviewView = "quantized" | "regions" | "vector";

interface PreviewWorkspaceProps {
  sourceUrl?: string;
  result?: ReconstructionResult;
  busy: boolean;
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

interface ZoomableContentProps {
  zoom: number;
  children: React.ReactNode;
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
          Math.max(
            0,
            Math.floor(((event.clientX - bounds.left) / bounds.width) * width),
          ),
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

function ZoomableContent({ zoom, children }: ZoomableContentProps) {
  return (
    <div className="zoom-content" style={{ width: `${zoom}%` }}>
      {children}
    </div>
  );
}

export function PreviewWorkspace({
  sourceUrl,
  result,
  busy,
  selectedRegionId,
  onSelectRegion,
}: PreviewWorkspaceProps) {
  const [view, setView] = useState<PreviewView>("regions");
  const [zoom, setZoom] = useState(100);
  const regionPixels = useMemo(
    () =>
      result ? renderRegionPixels(result.labelMap, result.regions) : undefined,
    [result],
  );
  const selectedPath = result?.regions.find(
    (region) => region.id === selectedRegionId,
  )?.pathData;

  const zoomOut = () => setZoom((current) => Math.max(50, current - 25));
  const zoomIn = () => setZoom((current) => Math.min(400, current + 25));

  return (
    <main className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-toolbar">
        <div>
          <p className="eyebrow">Preview</p>
          <h1 id="workspace-title">
            {result ? result.sourceFilename : "Start with a raster image"}
          </h1>
        </div>
        <div className="workspace-controls">
          <Tabs
            className="view-tabs"
            value={view}
            onChange={(_event, value: PreviewView) => setView(value)}
            aria-label="Reconstruction preview mode"
          >
            {(["quantized", "regions", "vector"] as const).map((option) => (
              <Tab key={option} value={option} label={option} disabled={!result} />
            ))}
          </Tabs>
          <ButtonGroup className="zoom-controls" aria-label="Preview zoom" size="small">
            <Button onClick={zoomOut} disabled={!result || zoom <= 50}>
              −
            </Button>
            <Button
              type="button"
              className="zoom-value"
              onClick={() => setZoom(100)}
              disabled={!result || zoom === 100}
              aria-label="Reset preview zoom to 100 percent"
            >
              {zoom}%
            </Button>
            <Button onClick={zoomIn} disabled={!result || zoom >= 400}>
              +
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="preview-stage">
        {busy ? (
          <div className="preview-loading" role="status" aria-live="polite">
            <CircularProgress color="secondary" size={30} />
            <span>Updating preview…</span>
          </div>
        ) : null}
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

        {result ? (
          <div className="comparison-grid">
            <section className="preview-pane" aria-labelledby="original-preview-title">
              <header>
                <h2 id="original-preview-title">Original</h2>
              </header>
              <div className="preview-pane-media">
                {sourceUrl ? (
                  <ZoomableContent zoom={zoom}>
                    <img
                      className="stage-media"
                      src={sourceUrl}
                      alt="Original uploaded artwork"
                    />
                  </ZoomableContent>
                ) : null}
              </div>
            </section>

            <section className="preview-pane" aria-labelledby="reconstruction-preview-title">
              <header>
                <h2 id="reconstruction-preview-title">Reconstruction</h2>
                <span>{view}</span>
              </header>
              <div className="preview-pane-media">
                {view === "quantized" ? (
                  <ZoomableContent zoom={zoom}>
                    <PixelCanvas
                      pixels={result.quantizedPixels}
                      width={result.width}
                      height={result.height}
                    />
                  </ZoomableContent>
                ) : null}

                {view === "regions" && regionPixels ? (
                  <ZoomableContent zoom={zoom}>
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
                      {selectedPath ? (
                        <svg
                          className="selection-overlay"
                          viewBox={`0 0 ${result.width} ${result.height}`}
                          aria-hidden="true"
                        >
                          <path d={selectedPath.join(" ")} />
                        </svg>
                      ) : null}
                    </div>
                  </ZoomableContent>
                ) : null}

                {view === "vector" ? (
                  <ZoomableContent zoom={zoom}>
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
                          className={
                            region.id === selectedRegionId ? "is-selected" : ""
                          }
                          onClick={() => onSelectRegion(region.id)}
                        />
                      ))}
                    </svg>
                  </ZoomableContent>
                ) : null}
              </div>
            </section>
          </div>
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

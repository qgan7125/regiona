import { useCallback, useState, type ReactNode } from "react";
import Button from "@mui/material/Button";

import type { AiGeneratedImage } from "../ai/openai-image-provider";
import type { ComparisonTransform } from "../preview/comparison-camera";
import { LinkedImagePreview } from "./LinkedImagePreview";

interface WorkflowImageComparisonProps {
  original: { url: string; filename: string; width: number; height: number; mimeType: string };
  output?: AiGeneratedImage;
  outputLabel: string;
  primaryAction?: ReactNode;
  onUseInRegionaVector: (image: AiGeneratedImage, label: string) => void;
}

const initialTransform: ComparisonTransform = {
  zoom: 100,
  center: { x: 0.5, y: 0.5 },
};

export function WorkflowImageComparison({
  original,
  output,
  outputLabel,
  primaryAction,
  onUseInRegionaVector,
}: WorkflowImageComparisonProps) {
  const extension = output?.mimeType === "image/jpeg" ? "jpg" : "png";
  const [transform, setTransform] = useState<ComparisonTransform>(initialTransform);
  const [loadedOutput, setLoadedOutput] = useState<
    { sourceUrl: string; width: number; height: number } | undefined
  >();
  const outputDimensions = loadedOutput?.sourceUrl === output?.dataUrl ? loadedOutput : undefined;
  const handleOutputLoad = useCallback((dimensions: { width: number; height: number }) => {
    if (!output) return;
    setLoadedOutput((current) => current?.sourceUrl === output.dataUrl
      && current.width === dimensions.width
      && current.height === dimensions.height
      ? current
      : { sourceUrl: output.dataUrl, ...dimensions });
  }, [output]);

  const zoomOut = () => setTransform((current) => ({
    ...current,
    zoom: Math.max(25, current.zoom - 25),
  }));
  const zoomIn = () => setTransform((current) => ({
    ...current,
    zoom: Math.min(800, current.zoom + 25),
  }));
  const resetTransform = () => setTransform(initialTransform);
  const candidateWidth = outputDimensions?.width ?? original.width;
  const candidateHeight = outputDimensions?.height ?? original.height;

  return (
    <section className="workflow-image-comparison" aria-label={`${outputLabel} comparison`}>
      <div className="workflow-image-comparison__toolbar">
        {primaryAction ? <div className="workflow-image-comparison__primary-action">{primaryAction}</div> : null}
        <div className="workflow-image-comparison__view-controls">
          <span>Linked views</span>
          <Button aria-label="Zoom out" disabled={transform.zoom <= 25} onClick={zoomOut} size="small" variant="outlined">-</Button>
          <output>{Math.round(transform.zoom)}%</output>
          <Button aria-label="Zoom in" disabled={transform.zoom >= 800} onClick={zoomIn} size="small" variant="outlined">+</Button>
          <Button
            disabled={transform.zoom === 100 && transform.center.x === 0.5 && transform.center.y === 0.5}
            onClick={resetTransform}
            size="small"
            variant="text"
          >
            Fit
          </Button>
        </div>
        {output ? (
          <div className="workflow-image-comparison__actions">
            <a download={`regiona-${outputLabel.toLowerCase().replaceAll(" ", "-")}.${extension}`} href={output.dataUrl}>
              Download {extension.toUpperCase()}
            </a>
            <Button onClick={() => onUseInRegionaVector(output, outputLabel)} size="small" variant="contained">
              Use in Regiona vector
            </Button>
          </div>
        ) : null}
      </div>
      <figure>
        <figcaption>
          Original
          <small>{original.width} x {original.height} · {original.mimeType.replace("image/", "").toUpperCase()}</small>
        </figcaption>
        <div className="workflow-image-comparison__media">
          <LinkedImagePreview
            ariaLabel={`Original: ${original.filename}. Drag to pan and use the mouse wheel to zoom both images.`}
            height={original.height}
            onTransformChange={setTransform}
            sourceUrl={original.url}
            transform={transform}
            width={original.width}
          />
        </div>
      </figure>
      <figure>
        <figcaption>
          {outputLabel}
          {outputDimensions ? <small>{outputDimensions.width} x {outputDimensions.height} · {output?.mimeType.replace("image/", "").toUpperCase()}</small> : null}
        </figcaption>
        {output ? (
          <div className="workflow-image-comparison__media">
            <LinkedImagePreview
              ariaLabel={`${outputLabel} candidate. Drag to pan and use the mouse wheel to zoom both images.`}
              height={candidateHeight}
              onImageLoad={handleOutputLoad}
              onTransformChange={setTransform}
              sourceUrl={output.dataUrl}
              transform={transform}
              width={candidateWidth}
            />
          </div>
        ) : <p className="workflow-image-comparison__empty">Generate a candidate to compare it with the original.</p>}
      </figure>
    </section>
  );
}

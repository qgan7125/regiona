import { useCallback, useState, type ReactNode } from "react";
import Button from "@mui/material/Button";

import type { AiGeneratedImage } from "../ai/openai-image-provider";
import type { ComparisonTransform } from "../preview/comparison-camera";
import { LinkedImagePreview } from "./LinkedImagePreview";

interface WorkflowImageComparisonProps {
  original: { url: string; filename: string; width: number; height: number; mimeType: string };
  referenceOptions?: WorkflowReferenceOption[];
  output?: AiGeneratedImage;
  outputLabel: string;
  primaryAction?: ReactNode;
  toolbarControl?: ReactNode;
  onUseInRegionaVector: (image: AiGeneratedImage, label: string) => void;
}

export interface WorkflowReferenceOption {
  id: string;
  label: string;
  url: string;
  filename: string;
  width: number;
  height: number;
  mimeType: string;
}

const initialTransform: ComparisonTransform = {
  zoom: 100,
  center: { x: 0.5, y: 0.5 },
};

export function WorkflowImageComparison({
  original,
  referenceOptions,
  output,
  outputLabel,
  primaryAction,
  toolbarControl,
  onUseInRegionaVector,
}: WorkflowImageComparisonProps) {
  const extension = output?.mimeType === "image/jpeg" ? "jpg" : "png";
  const defaultReference: WorkflowReferenceOption = { id: "original", label: "Original", ...original };
  const availableReferences = referenceOptions?.length ? referenceOptions : [defaultReference];
  const [referenceId, setReferenceId] = useState(availableReferences[0]?.id ?? defaultReference.id);
  const activeReference = availableReferences.find((reference) => reference.id === referenceId)
    ?? availableReferences[0]
    ?? defaultReference;
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
  const candidateWidth = outputDimensions?.width ?? activeReference.width;
  const candidateHeight = outputDimensions?.height ?? activeReference.height;

  return (
    <section className="workflow-image-comparison" aria-label={`${outputLabel} comparison`}>
      <div className="workflow-image-comparison__toolbar">
        {primaryAction ? <div className="workflow-image-comparison__primary-action">{primaryAction}</div> : null}
        {toolbarControl ? <div className="workflow-image-comparison__toolbar-control">{toolbarControl}</div> : null}
        {availableReferences.length > 1 ? (
          <div aria-label="Reference image" className="workflow-image-comparison__reference-toggle" role="group">
            {availableReferences.map((reference) => (
              <Button
                key={reference.id}
                onClick={() => setReferenceId(reference.id)}
                size="small"
                variant={reference.id === activeReference.id ? "contained" : "outlined"}
              >
                {reference.label}
              </Button>
            ))}
          </div>
        ) : null}
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
          <span>{activeReference.label}</span>
          <small>{original.width} x {original.height} · {original.mimeType.replace("image/", "").toUpperCase()}</small>
        </figcaption>
        <div className="workflow-image-comparison__media">
          <LinkedImagePreview
            ariaLabel={`${activeReference.label}: ${activeReference.filename}. Drag to pan and use the mouse wheel to zoom both images.`}
            height={activeReference.height}
            onTransformChange={setTransform}
            sourceUrl={activeReference.url}
            transform={transform}
            width={activeReference.width}
          />
        </div>
      </figure>
      <figure>
        <figcaption>
          <span>{outputLabel}</span>
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

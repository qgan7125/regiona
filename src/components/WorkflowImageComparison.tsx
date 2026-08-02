import { useState, type SyntheticEvent } from "react";
import type { AiGeneratedImage } from "../ai/openai-image-provider";
import Button from "@mui/material/Button";

interface WorkflowImageComparisonProps {
  original: { url: string; filename: string; width: number; height: number; mimeType: string };
  output?: AiGeneratedImage;
  outputLabel: string;
  onUseInRegionaVector: (image: AiGeneratedImage, label: string) => void;
}

export function WorkflowImageComparison({
  original,
  output,
  outputLabel,
  onUseInRegionaVector,
}: WorkflowImageComparisonProps) {
  const extension = output?.mimeType === "image/jpeg" ? "jpg" : "png";
  const [zoom, setZoom] = useState(100);
  const [outputDimensions, setOutputDimensions] = useState<{ width: number; height: number }>();
  const imageStyle = { width: `${zoom}%`, maxWidth: "none" };
  const handleOutputLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setOutputDimensions({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  };

  return (
    <section className="workflow-image-comparison" aria-label={`${outputLabel} comparison`}>
      <div className="workflow-image-comparison__toolbar">
        <span>Linked zoom</span>
        <Button aria-label="Zoom out" disabled={zoom <= 25} onClick={() => setZoom((value) => Math.max(25, value - 25))} size="small" variant="outlined">−</Button>
        <output>{zoom}%</output>
        <Button aria-label="Zoom in" disabled={zoom >= 800} onClick={() => setZoom((value) => Math.min(800, value + 25))} size="small" variant="outlined">+</Button>
        <Button disabled={zoom === 100} onClick={() => setZoom(100)} size="small" variant="text">Fit</Button>
      </div>
      <figure>
        <figcaption>Original <small>{original.width} × {original.height} · {original.mimeType.replace("image/", "").toUpperCase()}</small></figcaption>
        <div className="workflow-image-comparison__media">
          <img alt={`Original: ${original.filename}`} src={original.url} style={imageStyle} />
        </div>
      </figure>
      <figure>
        <figcaption>{outputLabel} {outputDimensions ? <small>{outputDimensions.width} × {outputDimensions.height} · {output?.mimeType.replace("image/", "").toUpperCase()}</small> : null}</figcaption>
        {output ? (
          <>
            <div className="workflow-image-comparison__media">
              <img alt={`${outputLabel} candidate`} onLoad={handleOutputLoad} src={output.dataUrl} style={imageStyle} />
            </div>
          </>
        ) : <p className="workflow-image-comparison__empty">Generate a candidate to compare it with the original.</p>}
      </figure>
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
    </section>
  );
}

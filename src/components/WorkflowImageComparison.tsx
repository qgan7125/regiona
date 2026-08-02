import type { AiGeneratedImage } from "../ai/openai-image-provider";
import Button from "@mui/material/Button";

interface WorkflowImageComparisonProps {
  original: { url: string; filename: string };
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

  return (
    <section className="workflow-image-comparison" aria-label={`${outputLabel} comparison`}>
      <figure>
        <figcaption>Original</figcaption>
        <img alt={`Original: ${original.filename}`} src={original.url} />
      </figure>
      <figure>
        <figcaption>{outputLabel}</figcaption>
        {output ? (
          <>
            <img alt={`${outputLabel} candidate`} src={output.dataUrl} />
            <a download={`regiona-${outputLabel.toLowerCase().replaceAll(" ", "-")}.${extension}`} href={output.dataUrl}>
              Download {extension.toUpperCase()}
            </a>
            <Button onClick={() => onUseInRegionaVector(output, outputLabel)} size="small" variant="contained">
              Use in Regiona vector
            </Button>
          </>
        ) : <p className="workflow-image-comparison__empty">Generate a candidate to compare it with the original.</p>}
      </figure>
    </section>
  );
}

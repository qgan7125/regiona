import type { AiGeneratedImage } from "../ai/openai-image-provider";

interface WorkflowImageComparisonProps {
  original: { url: string; filename: string };
  output?: AiGeneratedImage;
  outputLabel: string;
}

export function WorkflowImageComparison({
  original,
  output,
  outputLabel,
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
          </>
        ) : <p className="workflow-image-comparison__empty">Generate a candidate to compare it with the original.</p>}
      </figure>
    </section>
  );
}

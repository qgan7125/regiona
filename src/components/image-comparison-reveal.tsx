import { useState, type CSSProperties } from "react";

import type { ComparisonTransform } from "../preview/comparison-camera";
import { LinkedImagePreview } from "./LinkedImagePreview";
import { normalizeRevealPercentage } from "./image-comparison-reveal-state";

interface RevealImage {
  url: string;
  filename: string;
  width: number;
  height: number;
}

interface ImageComparisonRevealProps {
  original: RevealImage;
  output: RevealImage;
  outputLabel: string;
  transform: ComparisonTransform;
  onTransformChange: (transform: ComparisonTransform) => void;
  onOutputLoad: (dimensions: { width: number; height: number }) => void;
}

export function ImageComparisonReveal({
  original,
  output,
  outputLabel,
  transform,
  onTransformChange,
  onOutputLoad,
}: ImageComparisonRevealProps) {
  const [revealPercentage, setRevealPercentage] = useState(50);
  const style = { "--reveal-percentage": `${revealPercentage}%` } as CSSProperties;

  return (
    <div className="image-comparison-reveal" style={style}>
      <div className="image-comparison-reveal__layer">
        <LinkedImagePreview
          ariaLabel={`Original: ${original.filename}. Drag to pan and use the mouse wheel to zoom both images.`}
          height={original.height}
          onTransformChange={onTransformChange}
          sourceUrl={original.url}
          transform={transform}
          width={original.width}
        />
      </div>
      <div aria-hidden className="image-comparison-reveal__layer image-comparison-reveal__layer--output">
        <LinkedImagePreview
          ariaLabel={`${outputLabel}: ${output.filename}`}
          height={output.height}
          onImageLoad={onOutputLoad}
          onTransformChange={onTransformChange}
          sourceUrl={output.url}
          transform={transform}
          width={output.width}
        />
      </div>
      <div aria-hidden className="image-comparison-reveal__divider"><span /></div>
      <span aria-hidden className="image-comparison-reveal__label image-comparison-reveal__label--before">Original</span>
      <span aria-hidden className="image-comparison-reveal__label image-comparison-reveal__label--after">{outputLabel}</span>
      <input
        aria-label={`Reveal original and ${outputLabel}`}
        className="image-comparison-reveal__slider"
        max={100}
        min={0}
        onChange={(event) => setRevealPercentage(normalizeRevealPercentage(Number(event.target.value)))}
        type="range"
        value={revealPercentage}
      />
    </div>
  );
}

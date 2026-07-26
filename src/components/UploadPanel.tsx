import type { ChangeEvent } from "react";
import Button from "@mui/material/Button";
import Slider from "@mui/material/Slider";

import type { PaletteColor } from "../types/project";

interface SourceSummary {
  filename: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
}

interface UploadPanelProps {
  source?: SourceSummary;
  targetColors: number;
  palette: PaletteColor[];
  regionCount: number;
  busy: boolean;
  onTargetColorsChange: (value: number) => void;
  onRegenerate: () => void;
  onFile: (file: File) => void;
}

function formatPalettePercentage(percentage: number) {
  if (percentage > 0 && percentage < 0.005) return "<1%";
  return `${Math.round(percentage * 100)}%`;
}

export function UploadPanel({
  source,
  targetColors,
  palette,
  regionCount,
  busy,
  onTargetColorsChange,
  onRegenerate,
  onFile,
}: UploadPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  return (
    <aside className="panel tools-panel" aria-labelledby="project-tools-title">
      <div className="panel-heading">
        <p className="eyebrow">Project</p>
        <h2 id="project-tools-title">Source &amp; reconstruction</h2>
      </div>

      <Button
        component="label"
        className={`upload-control ${busy ? "is-disabled" : ""}`}
        disabled={busy}
        variant="outlined"
      >
        <span className="upload-icon" aria-hidden="true">
          ↗
        </span>
        <span className="upload-copy">
          <strong>{source ? "Replace source image" : "Choose source image"}</strong>
          <small>PNG, JPEG or WebP · up to 20 MB</small>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={busy}
        />
      </Button>

      {source ? (
        <dl className="source-summary">
          <div>
            <dt>File</dt>
            <dd title={source.filename}>{source.filename}</dd>
          </div>
          <div>
            <dt>Original</dt>
            <dd>
              {source.originalWidth} × {source.originalHeight}
            </dd>
          </div>
          <div>
            <dt>Working size</dt>
            <dd>
              {source.processedWidth} × {source.processedHeight}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="control-group">
        <div className="control-label">
          <label htmlFor="target-colors">Target palette</label>
          <output htmlFor="target-colors">{targetColors} colors</output>
        </div>
        <Slider
          id="target-colors"
          min={2}
          max={32}
          value={targetColors}
          disabled={busy}
          onChange={(_event, value) => onTargetColorsChange(Number(value))}
          valueLabelDisplay="auto"
          aria-label="Target palette colors"
        />
        <p className="helper-text">
          Choose a value, then regenerate the image. Color reduction never
          merges region identity.
        </p>
        <Button
          className="regenerate-button"
          disabled={!source || busy}
          onClick={onRegenerate}
          variant="contained"
          fullWidth
        >
          Regenerate with {targetColors} colors
        </Button>
      </div>

      <section className="palette-section" aria-labelledby="palette-title">
        <div className="section-title-row">
          <h3 id="palette-title">Palette</h3>
          <span>{regionCount ? `${regionCount} regions` : "Awaiting image"}</span>
        </div>
        {palette.length ? (
          <ul className="palette-list">
            {palette.map((color) => (
              <li key={color.id}>
                <span
                  className="swatch"
                  style={{ "--swatch": color.hex } as React.CSSProperties}
                  aria-hidden="true"
                />
                <code>{color.hex}</code>
                <span>{formatPalettePercentage(color.percentage)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">
            Your reduced palette will appear here after local analysis.
          </p>
        )}
      </section>
    </aside>
  );
}

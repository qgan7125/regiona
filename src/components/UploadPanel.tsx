import type { ChangeEvent } from "react";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { simplificationLabel, type RegionSimplification } from "../engine/regions/simplification";
import type { AiGeneratedImage } from "../ai/openai-image-provider";
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
  regionSimplification: RegionSimplification;
  tinyRegionMaximumArea: number;
  despeckleEnabled: boolean;
  palette: PaletteColor[];
  regionCount: number;
  busy: boolean;
  cleanRedraw?: AiGeneratedImage;
  colorReconstruction?: AiGeneratedImage;
  aiGenerationStage?: "redraw" | "color";
  aiError?: string;
  onTargetColorsChange: (value: number) => void;
  onRegionSimplificationChange: (value: RegionSimplification) => void;
  onDespeckleEnabledChange: (value: boolean) => void;
  onRegenerate: () => void;
  onFile: (file: File) => void;
  onGenerateCleanRedraw: () => void;
  onReconstructColors: () => void;
  onOpenGeminiSettings: () => void;
}

function formatPalettePercentage(percentage: number) {
  if (percentage > 0 && percentage < 0.005) return "<1%";
  return `${Math.round(percentage * 100)}%`;
}

export function UploadPanel({
  source,
  targetColors,
  regionSimplification,
  tinyRegionMaximumArea,
  despeckleEnabled,
  palette,
  regionCount,
  busy,
  cleanRedraw,
  colorReconstruction,
  aiGenerationStage,
  aiError,
  onTargetColorsChange,
  onRegionSimplificationChange,
  onDespeckleEnabledChange,
  onRegenerate,
  onFile,
  onGenerateCleanRedraw,
  onReconstructColors,
  onOpenGeminiSettings,
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

      <section className="ai-assist-section" aria-labelledby="ai-assist-title">
        <div className="section-title-row">
          <h3 id="ai-assist-title">AI clean redraw</h3>
          <span>Gemini BYOK</span>
        </div>
        <p className="helper-text">
          Creates a separate, cleaner intermediate image. Your uploaded original stays unchanged.
        </p>
        <Button
          className="ai-redraw-button"
          disabled={!source || busy}
          fullWidth
          onClick={onGenerateCleanRedraw}
          variant="outlined"
        >
          {aiGenerationStage === "redraw" ? "Generating clean redrawâ€¦" : "Generate clean redraw"}
        </Button>
        <Button
          className="ai-redraw-button"
          disabled={!cleanRedraw || busy}
          fullWidth
          onClick={onReconstructColors}
          variant="outlined"
        >
          {aiGenerationStage === "color" ? "Applying original colorsâ€¦" : "Apply original colors"}
        </Button>
        <Button
          className="ai-settings-link"
          onClick={onOpenGeminiSettings}
          size="small"
          type="button"
          variant="text"
        >
          Gemini settings
        </Button>
        {aiError ? <p className="ai-assist-error" role="alert">{aiError}</p> : null}
        {cleanRedraw ? (
          <figure className="ai-redraw-preview">
            <img alt="Generated clean redraw preview" src={cleanRedraw.dataUrl} />
            <figcaption>
              <span>Clean redraw ready</span>
              <a
                download={`regiona-clean-redraw.${cleanRedraw.mimeType === "image/jpeg" ? "jpg" : "png"}`}
                href={cleanRedraw.dataUrl}
              >
                Download {cleanRedraw.mimeType === "image/jpeg" ? "JPEG" : "PNG"}
              </a>
            </figcaption>
          </figure>
        ) : null}
        {colorReconstruction ? (
          <figure className="ai-redraw-preview">
            <img alt="Generated color reconstruction preview" src={colorReconstruction.dataUrl} />
            <figcaption>
              <span>Color reconstruction ready</span>
              <a
                download={`regiona-color-reconstruction.${colorReconstruction.mimeType === "image/jpeg" ? "jpg" : "png"}`}
                href={colorReconstruction.dataUrl}
              >
                Download {colorReconstruction.mimeType === "image/jpeg" ? "JPEG" : "PNG"}
              </a>
            </figcaption>
          </figure>
        ) : null}
      </section>

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
        <div className="control-label">
          <label id="region-simplification-label">Simplify regions</label>
          <output aria-labelledby="region-simplification-label">
            {regionSimplification === "off"
              ? "Off"
              : tinyRegionMaximumArea
                ? `${simplificationLabel(regionSimplification)} · ≤ ${tinyRegionMaximumArea}px`
                : simplificationLabel(regionSimplification)}
          </output>
        </div>
        <ToggleButtonGroup
          aria-labelledby="region-simplification-label"
          exclusive
          fullWidth
          size="small"
          value={regionSimplification}
          disabled={busy}
          onChange={(_event, value: RegionSimplification | null) => {
            if (value) onRegionSimplificationChange(value);
          }}
        >
          <ToggleButton value="off">Off</ToggleButton>
          <ToggleButton value="subtle">Subtle</ToggleButton>
          <ToggleButton value="balanced">Balanced</ToggleButton>
          <ToggleButton value="strong">Strong</ToggleButton>
        </ToggleButtonGroup>
        <p className="helper-text">
          Merge low-contrast fragments while protecting strong original-image edges.
        </p>
        <FormControlLabel
          control={
            <Switch
              checked={despeckleEnabled}
              disabled={busy}
              onChange={(_event, checked) => onDespeckleEnabledChange(checked)}
            />
          }
          label="Despeckle quantization noise"
        />
        <p className="helper-text">
          Smooths away isolated single-pixel color noise before regions are built.
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

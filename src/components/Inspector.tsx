import { useMemo } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import { getPaletteFillChoices } from "../app/editor-state";
import type { PaletteColor, VisualRegion } from "../types/project";

interface InspectorProps {
  regions: VisualRegion[];
  palette: PaletteColor[];
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
  onRecolor: (hex: string) => void;
}

export function Inspector({
  regions,
  palette,
  selectedRegionId,
  onSelectRegion,
  onRecolor,
}: InspectorProps) {
  const selected = regions.find((region) => region.id === selectedRegionId);
  const listedRegions = useMemo(
    () => [...regions].sort((a, b) => b.pixelArea - a.pixelArea).slice(0, 100),
    [regions],
  );
  const paletteFillChoices = useMemo(
    () => getPaletteFillChoices(palette),
    [palette],
  );

  return (
    <aside className="panel inspector-panel" aria-labelledby="inspector-title">
      <div className="panel-heading">
        <p className="eyebrow">Inspector</p>
        <h2 id="inspector-title">Region details</h2>
      </div>

      {selected ? (
        <section className="region-inspector">
          <div className="region-identity">
            <span
              className="large-swatch"
              style={{ "--swatch": selected.fill } as React.CSSProperties}
              aria-hidden="true"
            />
            <div>
              <strong>{selected.id}</strong>
              <span>{selected.origin}</span>
            </div>
          </div>

          <dl className="inspector-grid">
            <div>
              <dt>Area</dt>
              <dd>{selected.pixelArea.toLocaleString()} px</dd>
            </div>
            <div>
              <dt>Paths</dt>
              <dd>{selected.pathData.length}</dd>
            </div>
            <div>
              <dt>Opacity</dt>
              <dd>{Math.round(selected.opacity * 100)}%</dd>
            </div>
            <div>
              <dt>Bounds</dt>
              <dd>
                {selected.bounds.width} × {selected.bounds.height}
              </dd>
            </div>
            <div>
              <dt>Color ID</dt>
              <dd>{selected.colorId}</dd>
            </div>
          </dl>

          <TextField
            className="region-color-field"
            label="Region fill"
            type="color"
            value={selected.fill}
            onChange={(event) => onRecolor(event.currentTarget.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { "aria-label": `Fill color for ${selected.id}` },
            }}
            size="small"
            fullWidth
          />
          <div className="palette-fill-control">
            <span>Choose from palette</span>
            <div className="palette-fill-options" role="list">
              {paletteFillChoices.map((fill) => (
                <Button
                  key={fill}
                  className={fill === selected.fill ? "is-active" : ""}
                  style={{ "--swatch": fill } as React.CSSProperties}
                  onClick={() => onRecolor(fill)}
                  aria-label={`Set ${selected.id} fill to ${fill}`}
                  aria-pressed={fill === selected.fill}
                  variant={fill === selected.fill ? "contained" : "outlined"}
                  size="small"
                >
                  <span aria-hidden="true" />
                  <code>{fill}</code>
                </Button>
              ))}
            </div>
          </div>
          <p className="helper-text">
            This changes appearance only. Geometry and neighboring regions remain
            independent.
          </p>
        </section>
      ) : (
        <p className="empty-copy">
          Select a region in the map or list to inspect and recolor it.
        </p>
      )}

      <section className="region-list-section" aria-labelledby="region-list-title">
        <div className="section-title-row">
          <h3 id="region-list-title">Largest regions</h3>
          <span>{Math.min(regions.length, 100)} shown</span>
        </div>
        <ul className="region-list">
          {listedRegions.map((region) => (
            <li key={region.id}>
              <Button
                type="button"
                className={region.id === selectedRegionId ? "is-selected" : ""}
                onClick={() => onSelectRegion(region.id)}
                variant="text"
                fullWidth
              >
                <span
                  className="swatch"
                  style={{ "--swatch": region.fill } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span>{region.id}</span>
                <small>{region.pixelArea.toLocaleString()} px</small>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

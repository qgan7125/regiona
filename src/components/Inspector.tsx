import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

import { getPaletteFillChoices } from "../app/editor-state";
import type { PaletteColor, VisualRegion } from "../types/project";

interface InspectorProps {
  regions: VisualRegion[];
  palette: PaletteColor[];
  busy: boolean;
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
  onRecolor: (hex: string) => void;
}

export function Inspector({
  regions,
  palette,
  busy,
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
  const [paletteDialogOpen, setPaletteDialogOpen] = useState(false);

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
            disabled={busy}
          />
          <div className="palette-fill-control">
            <Button
              onClick={() => setPaletteDialogOpen(true)}
              variant="outlined"
              disabled={busy || !paletteFillChoices.length}
            >
              Search full palette
            </Button>
          </div>
          <p className="helper-text">
            Right-click a region to apply a close palette color from Original.
            Geometry and neighboring regions remain independent.
          </p>
        </section>
      ) : (
        <p className="empty-copy">
          Select a region in the map or list to inspect and recolor it.
        </p>
      )}

      <Dialog
        open={paletteDialogOpen}
        onClose={() => setPaletteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="palette-picker-title"
      >
        <DialogTitle id="palette-picker-title">Choose region fill</DialogTitle>
        <DialogContent>
          <Autocomplete
            autoHighlight
            options={paletteFillChoices}
            value={selected?.fill.toLowerCase() ?? null}
            onChange={(_event, fill) => {
              if (!fill) return;
              onRecolor(fill);
              setPaletteDialogOpen(false);
            }}
            renderOption={(props, fill) => (
              <li {...props} key={fill}>
                <span
                  className="dialog-palette-swatch"
                  style={{ "--swatch": fill } as React.CSSProperties}
                  aria-hidden="true"
                />
                <code>{fill}</code>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} autoFocus label="Search palette colors" />
            )}
          />
        </DialogContent>
      </Dialog>

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

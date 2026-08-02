import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import { getPaletteFillChoices } from "../app/editor-state";
import type { PaletteColor, VisualRegion } from "../types/project";

interface InspectorProps {
  regions: VisualRegion[];
  palette: PaletteColor[];
  busy: boolean;
  selectedRegionIds: string[];
  canUndoColor: boolean;
  canRedoColor: boolean;
  canExportSvg: boolean;
  onSelectRegions: (regionIds: string[]) => void;
  onRecolor: (hex: string) => void;
  onMergeSelected: () => void;
  onUndoColor: () => void;
  onRedoColor: () => void;
  onExportSvg: () => void;
}

export function Inspector({
  regions,
  palette,
  busy,
  selectedRegionIds,
  canUndoColor,
  canRedoColor,
  canExportSvg,
  onSelectRegions,
  onRecolor,
  onMergeSelected,
  onUndoColor,
  onRedoColor,
  onExportSvg,
}: InspectorProps) {
  const selected = regions.filter((region) => selectedRegionIds.includes(region.id));
  const primarySelected = selected.at(-1);
  const canMergeSelected = selected.length >= 2
    && selected.every((region) => region.fill.toLowerCase() === selected[0]?.fill.toLowerCase()
      && region.opacity === selected[0]?.opacity);
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

      <div className="inspector-history-actions" role="toolbar" aria-label="Region edit history">
        <Tooltip title="Undo color change — Ctrl/Cmd + Z" placement="top">
          <span>
            <Button size="small" variant="outlined" disabled={!canUndoColor} onClick={onUndoColor}>
              Undo edit
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Redo color change — Ctrl/Cmd + Shift + Z or Ctrl + Y" placement="top">
          <span>
            <Button size="small" variant="outlined" disabled={!canRedoColor} onClick={onRedoColor}>
              Redo edit
            </Button>
          </span>
        </Tooltip>
      </div>

      {canExportSvg ? (
        <section className="inspector-export" aria-label="Project output">
          <div>
            <p className="eyebrow">Output</p>
            <strong>Editable SVG</strong>
          </div>
          <Button onClick={onExportSvg} size="small" variant="contained">Export SVG</Button>
        </section>
      ) : null}

      {primarySelected ? (
        <section className="region-inspector">
          <div className="region-identity">
            <span
              className="large-swatch"
              style={{ "--swatch": primarySelected.fill } as React.CSSProperties}
              aria-hidden="true"
            />
            <div>
              <strong>{selected.length > 1 ? `${selected.length} regions selected` : primarySelected.id}</strong>
              <span>{selected.length > 1 ? "Batch edit" : primarySelected.origin}</span>
            </div>
          </div>

          <dl className="inspector-grid">
            <div>
              <dt>Area</dt>
              <dd>{selected.reduce((sum, region) => sum + region.pixelArea, 0).toLocaleString()} px</dd>
            </div>
            <div>
              <dt>Paths</dt>
              <dd>{selected.reduce((sum, region) => sum + region.pathData.length, 0)}</dd>
            </div>
            <div>
              <dt>Opacity</dt>
              <dd>{Math.round(primarySelected.opacity * 100)}%</dd>
            </div>
            <div>
              <dt>Bounds</dt>
              <dd>
                {primarySelected.bounds.width} × {primarySelected.bounds.height}
              </dd>
            </div>
            <div>
              <dt>Color ID</dt>
              <dd>{selected.length > 1 ? "Mixed" : primarySelected.colorId}</dd>
            </div>
          </dl>

          <TextField
            className="region-color-field"
            label="Region fill"
            type="color"
            value={primarySelected.fill}
            onChange={(event) => onRecolor(event.currentTarget.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { "aria-label": `Fill color for ${selected.length} selected regions` },
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
          <Tooltip
            title={canMergeSelected
              ? "Merge the selected same-color regions into one editable SVG path"
              : "Select at least two regions with the same fill to merge"}
            placement="top"
          >
            <span>
              <Button
                disabled={busy || !canMergeSelected}
                onClick={onMergeSelected}
                variant="outlined"
              >
                Merge same-color SVG regions
              </Button>
            </span>
          </Tooltip>
          <p className="helper-text">
            Right-click a region to apply a close palette color from Original. Merging keeps disconnected parts as one SVG path with multiple subpaths.
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
            value={primarySelected?.fill.toLowerCase() ?? null}
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
                className={selectedRegionIds.includes(region.id) ? "is-selected" : ""}
                onClick={(event) => {
                  if (event.shiftKey) onSelectRegions(selectedRegionIds.includes(region.id)
                    ? selectedRegionIds.filter((id) => id !== region.id)
                    : [...selectedRegionIds, region.id]);
                  else onSelectRegions([region.id]);
                }}
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

import { Fragment, type Dispatch, type SetStateAction, type SyntheticEvent, useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";

import { renderRegionPixels } from "../engine/reconstruct";
import { getPaletteSuggestions } from "../app/palette-suggestions";
import type { Camera } from "../preview/camera";
import type { ColorSample } from "../preview/color-sample";
import type { ReconstructionResult } from "../types/project";
import { PixiPreview } from "./PixiPreview";

type PreviewView = "quantized" | "regions" | "vector";
type BrushTool = "pan" | "add" | "remove";

interface PickedColor {
  anchorPosition: { left: number; top: number };
  sample: ColorSample;
}

interface RegionColorMenu {
  anchorPosition: { left: number; top: number };
  regionId: string;
}

interface PreviewWorkspaceProps {
  originalPixels?: Uint8ClampedArray;
  result?: ReconstructionResult;
  busy: boolean;
  pickedColors: ColorSample[];
  selectedRegionIds: string[];
  canUndoSelection: boolean;
  canRedoSelection: boolean;
  onSelectRegions: Dispatch<SetStateAction<string[]>>;
  onUndoSelection: () => void;
  onRedoSelection: () => void;
  onPickColor: (color: ColorSample) => void;
  onRecolorRegions: (regionIds: string[], fill: string) => void;
}

function vectorSvg(result: ReconstructionResult) {
  const paths = result.regions
    .map(
      // Same-color stroke papers over the WebGL anti-aliasing seam between adjacent shapes; preview-only, export stays stroke-free.
      (region) =>
        `<path d="${region.pathData.join(" ")}" fill="${region.fill}" fill-opacity="${region.opacity}" fill-rule="evenodd" stroke="${region.fill}" stroke-opacity="${region.opacity}" stroke-width="1" />`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">${paths}</svg>`;
}

export function PreviewWorkspace({
  originalPixels,
  result,
  busy,
  pickedColors,
  selectedRegionIds,
  canUndoSelection,
  canRedoSelection,
  onSelectRegions,
  onUndoSelection,
  onRedoSelection,
  onPickColor,
  onRecolorRegions,
}: PreviewWorkspaceProps) {
  const [view, setView] = useState<PreviewView>("regions");
  const [zoom, setZoom] = useState(100);
  const [linkViews, setLinkViews] = useState(true);
  const [linkedCamera, setLinkedCamera] = useState<Camera>();
  const [isChangingView, setIsChangingView] = useState(false);
  const [pickedColor, setPickedColor] = useState<PickedColor>();
  const [regionColorMenu, setRegionColorMenu] = useState<RegionColorMenu>();
  const [brushTool, setBrushTool] = useState<BrushTool>("pan");
  const [brushSize, setBrushSize] = useState(24);
  const regionPixels = useMemo(
    () =>
      result ? renderRegionPixels(result.labelMap, result.regions) : undefined,
    [result],
  );
  const svgMarkup = useMemo(() => (result ? vectorSvg(result) : undefined), [result]);
  const selectedPreviewRegions = useMemo(() => {
    if (!result) return [];
    const selectedIds = new Set(selectedRegionIds);
    return result.regions.flatMap((region, index) => (selectedIds.has(region.id)
      ? [{
        path: region.pathData.join(" "),
        fill: region.fill,
        opacity: region.opacity,
        bounds: region.bounds,
        regionNumber: index + 1,
      }]
      : []));
  }, [result, selectedRegionIds]);
  const paletteSuggestions = useMemo(
    () => getPaletteSuggestions(pickedColors, result?.palette ?? []),
    [pickedColors, result?.palette],
  );

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape" && selectedRegionIds.length) {
        event.preventDefault();
        onSelectRegions([]);
        return;
      }
      if (event.key.toLowerCase() === "b" && !(event.metaKey || event.ctrlKey || event.altKey)) {
        event.preventDefault();
        setBrushTool(event.shiftKey ? "remove" : "add");
      }
    };

    window.addEventListener("keydown", handleToolShortcut);
    return () => window.removeEventListener("keydown", handleToolShortcut);
  }, [onSelectRegions, selectedRegionIds.length]);

  const zoomOut = () => {
    setPickedColor(undefined);
    setZoom((current) => Math.max(50, current - 25));
  };
  const zoomIn = () => {
    setPickedColor(undefined);
    setZoom((current) => Math.min(2000, current + 25));
  };
  const handleCameraChange = (camera: Camera) => {
    setPickedColor(undefined);
    if (linkViews) setLinkedCamera(camera);
  };
  const handleViewChange = (_event: SyntheticEvent, nextView: PreviewView) => {
    if (nextView === view) return;
    setIsChangingView(true);
    window.requestAnimationFrame(() => {
      setView(nextView);
      window.requestAnimationFrame(() => setIsChangingView(false));
    });
  };

  return (
    <main className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-toolbar">
        <div>
          <p className="eyebrow">Preview</p>
          <h1 id="workspace-title">
            {result ? result.sourceFilename : "Start with a raster image"}
          </h1>
        </div>
        <div className="workspace-controls">
          <Tabs
            className="view-tabs"
            value={view}
            onChange={handleViewChange}
            aria-label="Reconstruction preview mode"
          >
            {(["quantized", "regions", "vector"] as const).map((option) => (
              <Tab key={option} value={option} label={option} disabled={!result} />
            ))}
          </Tabs>
          <ButtonGroup className="zoom-controls" aria-label="Preview zoom" size="small">
            <Button onClick={zoomOut} disabled={!result || zoom <= 50}>−</Button>
            <Button
              className="zoom-value"
              onClick={() => {
                setPickedColor(undefined);
                setZoom(100);
              }}
              disabled={!result || zoom === 100}
              aria-label="Reset preview zoom to 100 percent"
            >
              {Math.round(zoom)}%
            </Button>
            <Button onClick={zoomIn} disabled={!result || zoom >= 2000}>+</Button>
          </ButtonGroup>
          <FormControlLabel
            className="link-views-toggle"
            control={
              <Switch
                checked={linkViews}
                size="small"
                onChange={(_event, checked) => {
                  setLinkViews(checked);
                  setLinkedCamera(undefined);
                }}
              />
            }
            label="Link views"
          />
        </div>
      </div>

      <div className="preview-stage">
        {busy || isChangingView ? (
          <div className="preview-loading" role="status" aria-live="polite">
            <CircularProgress color="secondary" size={30} />
            <span>{isChangingView ? "Switching preview…" : "Updating preview…"}</span>
          </div>
        ) : null}

        {!result ? (
          <div className="stage-empty">
            <span aria-hidden="true">R</span>
            <h2>Regions, not traces.</h2>
            <p>
              Upload artwork to reduce its palette, separate connected regions,
              and produce independently editable SVG paths.
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="comparison-grid">
            <section className="preview-pane" aria-labelledby="original-preview-title">
              <header>
                <h2 id="original-preview-title">Original</h2>
                {pickedColors.length ? (
                  <div className="picked-color-list" aria-label="Recently picked colors">
                    <span>Picked</span>
                    {pickedColors.slice(0, 4).map((color) => (
                      <span
                        key={color.hex}
                        className="picked-color-chip"
                        style={{ "--swatch": color.hex } as React.CSSProperties}
                        title={`${color.hex} · ${color.rgb}`}
                      >
                        <i aria-hidden="true" />
                        <code>{color.hex}</code>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="preview-pane-hint">Click to pick a color</span>
                )}
              </header>
              <div className="preview-pane-media">
                {originalPixels ? (
                  <PixiPreview
                    width={result.width}
                    height={result.height}
                    zoom={zoom}
                    pixels={originalPixels}
                    isViewLinked={linkViews}
                    linkedCamera={linkViews ? linkedCamera : undefined}
                    onZoomChange={setZoom}
                    onCameraChange={handleCameraChange}
                    onPickColor={(sample, anchorPosition) => {
                      setPickedColor({ sample, anchorPosition });
                      onPickColor(sample);
                    }}
                    ariaLabel="Original uploaded artwork. Click a pixel to sample its color, drag to pan, and use the mouse wheel to zoom."
                  />
                ) : null}
              </div>
            </section>

            <section className="preview-pane" aria-labelledby="reconstruction-preview-title">
              <header>
                <h2 id="reconstruction-preview-title">Reconstruction</h2>
                <div className="preview-pane-actions">
                  <span>{view}{selectedRegionIds.length ? ` · ${selectedRegionIds.length} selected` : ""}</span>
                </div>
              </header>
              <div className="preview-pane-media">
                <div className="canvas-tool-bar" role="toolbar" aria-label="Region selection tools">
                  <ToggleButtonGroup
                    exclusive
                    value={brushTool}
                    onChange={(_event, nextTool: BrushTool | null) => {
                      if (nextTool) setBrushTool(nextTool);
                    }}
                    size="small"
                    aria-label="Region selection tool"
                  >
                    <ToggleButton value="pan" aria-label="Pan canvas">
                      <Tooltip title="Pan canvas — hold Space" placement="top"><span>Pan</span></Tooltip>
                    </ToggleButton>
                    <ToggleButton value="add" aria-label="Brush to add regions">
                      <Tooltip title="Brush add — B" placement="top"><span>Brush +</span></Tooltip>
                    </ToggleButton>
                    <ToggleButton value="remove" aria-label="Brush to remove regions">
                      <Tooltip title="Brush subtract — Shift + B" placement="top"><span>Brush −</span></Tooltip>
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Tooltip title="Clear selection — Esc" placement="top">
                    <span>
                      <Button
                        className="canvas-tool-action"
                        size="small"
                        disabled={!selectedRegionIds.length}
                        onClick={() => onSelectRegions([])}
                      >
                        Clear
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Undo selection — Alt/Option + Z" placement="top">
                    <span>
                      <Button
                        className="canvas-tool-action"
                        size="small"
                        disabled={!canUndoSelection}
                        onClick={onUndoSelection}
                      >
                        Undo select
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Redo selection — Alt/Option + Shift + Z or Y" placement="top">
                    <span>
                      <Button
                        className="canvas-tool-action"
                        size="small"
                        disabled={!canRedoSelection}
                        onClick={onRedoSelection}
                      >
                        Redo select
                      </Button>
                    </span>
                  </Tooltip>
                  {brushTool !== "pan" ? <span className="canvas-tool-hint">Hold Space to pan</span> : null}
                </div>
                {brushTool !== "pan" ? (
                  <label className="canvas-brush-size">
                    <span>Brush size</span>
                    <Slider
                      aria-label="Brush size"
                      value={brushSize}
                      min={8}
                      max={96}
                      step={4}
                      onChange={(_event, nextSize) => setBrushSize(nextSize as number)}
                    />
                    <output>{brushSize}px</output>
                  </label>
                ) : null}
                <PixiPreview
                  width={result.width}
                  height={result.height}
                  zoom={zoom}
                  pixels={view === "quantized" ? result.quantizedPixels : view === "regions" ? regionPixels : undefined}
                  selectionPixels={regionPixels}
                  svgMarkup={view === "vector" ? svgMarkup : undefined}
                  labelMap={result.labelMap}
                  selectedRegions={selectedPreviewRegions}
                  isViewLinked={linkViews}
                  linkedCamera={linkViews ? linkedCamera : undefined}
                  onZoomChange={setZoom}
                  onCameraChange={handleCameraChange}
                  brushMode={brushTool === "pan" ? undefined : brushTool}
                  brushSize={brushSize}
                  onSelectRegion={(regionNumbers, mode = "replace") => {
                    const numbers = Array.isArray(regionNumbers) ? regionNumbers : [regionNumbers];
                    const regionIds = numbers
                      .map((regionNumber) => result.regions[regionNumber - 1]?.id)
                      .filter((id): id is string => Boolean(id));
                    if (!regionIds.length) return;
                    if (mode === "replace") onSelectRegions(regionIds);
                    else if (mode === "toggle") onSelectRegions((current) => current.some((id) => regionIds.includes(id))
                      ? current.filter((id) => !regionIds.includes(id))
                      : [...current, ...regionIds.filter((id) => !current.includes(id))]);
                    else if (mode === "remove") onSelectRegions((current) => current.filter((id) => !regionIds.includes(id)));
                    else onSelectRegions((current) => [...current, ...regionIds.filter((id) => !current.includes(id))]);
                  }}
                  onContextMenuRegion={(regionNumber, anchorPosition) => {
                    const region = result.regions[regionNumber - 1];
                    if (!region) return;
                    setRegionColorMenu({ anchorPosition, regionId: region.id });
                  }}
                  onClearSelection={() => onSelectRegions([])}
                  ariaLabel="Reconstruction preview. Click to select a region, right-click to choose a similar palette color, drag to pan, and use the mouse wheel to zoom. Choose Brush plus or minus to add or remove multiple regions; hold Space while brushing to pan."
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <Popover
        open={Boolean(pickedColor)}
        anchorReference="anchorPosition"
        anchorPosition={pickedColor?.anchorPosition}
        onClose={(_event, reason) => {
          if (reason !== "backdropClick") setPickedColor(undefined);
        }}
        slotProps={{
          root: { className: "picked-color-popover-root" },
          paper: { className: "picked-color-popover" },
        }}
      >
        {pickedColor ? (
          <div className="picked-color-content">
            <span
              className="picked-color-swatch"
              style={{ "--swatch": pickedColor.sample.hex } as React.CSSProperties}
              aria-hidden="true"
            />
            <div>
              <p>Picked color</p>
              <code>{pickedColor.sample.hex}</code>
              <span>{pickedColor.sample.rgb}</span>
            </div>
          </div>
        ) : null}
      </Popover>

      <Menu
        open={Boolean(regionColorMenu)}
        anchorReference="anchorPosition"
        anchorPosition={regionColorMenu?.anchorPosition}
        onClose={() => setRegionColorMenu(undefined)}
        slotProps={{
          list: { "aria-label": "Similar palette colors" },
          paper: { className: "similar-color-menu" },
        }}
      >
        {paletteSuggestions.length ? paletteSuggestions.map((group) => (
          <Fragment key={group.picked.hex}>
            <ListSubheader disableSticky>
              Similar to {group.picked.hex}
            </ListSubheader>
            {group.colors.map((fill) => (
              <MenuItem
                key={`${group.picked.hex}-${fill}`}
                onClick={() => {
                  if (regionColorMenu) onRecolorRegions(
                    selectedRegionIds.includes(regionColorMenu.regionId) ? selectedRegionIds : [regionColorMenu.regionId],
                    fill,
                  );
                  setRegionColorMenu(undefined);
                }}
              >
                <span
                  className="dialog-palette-swatch"
                  style={{ "--swatch": fill } as React.CSSProperties}
                  aria-hidden="true"
                />
                <code>{fill}</code>
              </MenuItem>
            ))}
          </Fragment>
        )) : (
          <MenuItem disabled>Pick a color from Original first.</MenuItem>
        )}
      </Menu>

      <footer className="workspace-footer">
        <span>Local processing</span>
        <span aria-hidden="true">·</span>
        <span>{result ? `${result.width} × ${result.height}` : "No image loaded"}</span>
        <span aria-hidden="true">·</span>
        <span>{result ? `${result.regions.length} independent regions` : "Phase 1"}</span>
      </footer>
    </main>
  );
}

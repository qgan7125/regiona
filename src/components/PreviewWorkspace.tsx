import { Fragment, type SyntheticEvent, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { renderRegionPixels } from "../engine/reconstruct";
import { getPaletteSuggestions } from "../app/palette-suggestions";
import type { Camera } from "../preview/camera";
import type { ColorSample } from "../preview/color-sample";
import type { ReconstructionResult } from "../types/project";
import { PixiPreview } from "./PixiPreview";

type PreviewView = "quantized" | "regions" | "vector";

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
  selectedRegionId?: string;
  onSelectRegion: (regionId?: string) => void;
  onPickColor: (color: ColorSample) => void;
  onRecolorRegion: (regionId: string, fill: string) => void;
}

function vectorSvg(result: ReconstructionResult) {
  const paths = result.regions
    .map(
      (region) =>
        `<path d="${region.pathData.join(" ")}" fill="${region.fill}" fill-opacity="${region.opacity}" fill-rule="evenodd" />`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${result.width}" height="${result.height}" viewBox="0 0 ${result.width} ${result.height}">${paths}</svg>`;
}

export function PreviewWorkspace({
  originalPixels,
  result,
  busy,
  pickedColors,
  selectedRegionId,
  onSelectRegion,
  onPickColor,
  onRecolorRegion,
}: PreviewWorkspaceProps) {
  const [view, setView] = useState<PreviewView>("regions");
  const [zoom, setZoom] = useState(100);
  const [linkViews, setLinkViews] = useState(true);
  const [linkedCamera, setLinkedCamera] = useState<Camera>();
  const [isChangingView, setIsChangingView] = useState(false);
  const [pickedColor, setPickedColor] = useState<PickedColor>();
  const [regionColorMenu, setRegionColorMenu] = useState<RegionColorMenu>();
  const regionPixels = useMemo(
    () =>
      result ? renderRegionPixels(result.labelMap, result.regions) : undefined,
    [result],
  );
  const svgMarkup = useMemo(() => (result ? vectorSvg(result) : undefined), [result]);
  const selectedRegion = useMemo(
    () => result?.regions.find((region) => region.id === selectedRegionId),
    [result, selectedRegionId],
  );
  const paletteSuggestions = useMemo(
    () => getPaletteSuggestions(pickedColors, result?.palette ?? []),
    [pickedColors, result?.palette],
  );

  const zoomOut = () => {
    setPickedColor(undefined);
    setZoom((current) => Math.max(50, current - 25));
  };
  const zoomIn = () => {
    setPickedColor(undefined);
    setZoom((current) => Math.min(1000, current + 25));
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
            <Button onClick={zoomIn} disabled={!result || zoom >= 1000}>+</Button>
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
                  <span>{view}{selectedRegionId ? " · selected" : ""}</span>
                  <Button
                    size="small"
                    disabled={!selectedRegionId}
                    onClick={() => onSelectRegion(undefined)}
                  >
                    Clear selection
                  </Button>
                </div>
              </header>
              <div className="preview-pane-media">
                <PixiPreview
                  width={result.width}
                  height={result.height}
                  zoom={zoom}
                  pixels={view === "quantized" ? result.quantizedPixels : view === "regions" ? regionPixels : undefined}
                  svgMarkup={view === "vector" ? svgMarkup : undefined}
                  labelMap={result.labelMap}
                  selectedPath={selectedRegion?.pathData.join(" ")}
                  selectedFill={selectedRegion?.fill}
                  selectedOpacity={selectedRegion?.opacity}
                  isViewLinked={linkViews}
                  linkedCamera={linkViews ? linkedCamera : undefined}
                  onZoomChange={setZoom}
                  onCameraChange={handleCameraChange}
                  onSelectRegion={(regionNumber) => {
                    const region = result.regions[regionNumber - 1];
                    if (region) onSelectRegion(region.id);
                  }}
                  onContextMenuRegion={(regionNumber, anchorPosition) => {
                    const region = result.regions[regionNumber - 1];
                    if (!region) return;
                    setRegionColorMenu({ anchorPosition, regionId: region.id });
                  }}
                  onClearSelection={() => onSelectRegion(undefined)}
                  ariaLabel="Reconstruction preview. Click to select a region, right-click to choose a similar palette color, drag to pan, and use the mouse wheel to zoom."
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
                  if (regionColorMenu) onRecolorRegion(regionColorMenu.regionId, fill);
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

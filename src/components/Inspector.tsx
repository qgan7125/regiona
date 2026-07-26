import { useMemo } from "react";

import type { VisualRegion } from "../types/project";

interface InspectorProps {
  regions: VisualRegion[];
  selectedRegionId?: string;
  onSelectRegion: (regionId: string) => void;
  onRecolor: (hex: string) => void;
}

export function Inspector({
  regions,
  selectedRegionId,
  onSelectRegion,
  onRecolor,
}: InspectorProps) {
  const selected = regions.find((region) => region.id === selectedRegionId);
  const listedRegions = useMemo(
    () => [...regions].sort((a, b) => b.pixelArea - a.pixelArea).slice(0, 100),
    [regions],
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

          <label className="color-control">
            <span>Region fill</span>
            <span className="color-input-row">
              <input
                type="color"
                value={selected.fill}
                onInput={(event) => onRecolor(event.currentTarget.value)}
                aria-label={`Fill color for ${selected.id}`}
              />
              <code>{selected.fill}</code>
            </span>
          </label>
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
              <button
                type="button"
                className={region.id === selectedRegionId ? "is-selected" : ""}
                onClick={() => onSelectRegion(region.id)}
              >
                <span
                  className="swatch"
                  style={{ "--swatch": region.fill } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span>{region.id}</span>
                <small>{region.pixelArea.toLocaleString()} px</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

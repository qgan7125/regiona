# Regiona

Regiona is a browser-based, region-first reconstruction editor. It turns raster
artwork into independently editable visual regions and exports structured SVG
instead of treating every palette color as one merged object.

The full product and engineering specification lives in
[`docs/regiona-design.md`](docs/regiona-design.md).

## Current prototype

This first implementation slice includes:

- local PNG, JPEG, and WebP decoding with file and pixel limits;
- deterministic weighted palette reduction that preserves substantial colors and removes unused entries;
- four-connected component labeling with stable scan-order region IDs;
- independent same-color regions;
- closed orthogonal SVG paths with hole support;
- off-main-thread processing in a Web Worker;
- original, quantized, region-map, and vector previews;
- side-by-side original and reconstruction previews with 50%–400% zoom;
- region selection, palette-based recoloring, and color-edit undo;
- explicit palette regeneration after adjusting the target color count;
- Material UI controls with a Regiona-specific theme;
- PixiJS-backed previews with wheel zoom and drag-to-pan;
- loading feedback while regenerating or recoloring;
- searchable Material UI palette picker for region fills;
- editable SVG and Regiona project JSON export.

OpenCV.js analysis, shared-boundary reconstruction, curve fitting, split/merge
operations, redo, and AI proposals are intentionally scheduled for later
development phases. The geometric core does not depend on cloud AI.

## Development

Requirements: Node.js 24+ and npm 11+.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Architecture

- `src/engine`: deterministic palette, region, contour, and SVG logic.
- `src/workers`: transferable-buffer worker protocol and client.
- `src/components`: accessible editor panels and previews.
- `src/types`: serializable Regiona project model subset.
- `tests`: fast behavior-focused tests for the reconstruction core.

Image data stays in the browser. This prototype has no backend and makes no
network request with uploaded artwork.

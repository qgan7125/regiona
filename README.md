# Regiona

Regiona is a browser-based, region-first reconstruction editor. It turns raster
artwork into independently editable visual regions and exports structured SVG
instead of treating every palette color as one merged object.

## Live MVP

Try Regiona in your browser: **[qgan7125.github.io/regiona](https://qgan7125.github.io/regiona/)**

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
- PixiJS-backed previews with wheel zoom, drag-to-pan, optional linked views, and selection focus;
- loading feedback while regenerating or recoloring;
- searchable Material UI palette picker for region fills;
- editable SVG and Regiona project JSON export;
- an optional, user-composed Gemini workflow for reverse-prompt analysis, prompt redraw, clean redraw, black line art, colorized line art, and AI high-resolution candidates.

OpenCV.js analysis, shared-boundary reconstruction, curve fitting, split/merge
operations, and richer geometry editing are intentionally scheduled for later
development phases. The deterministic geometric core does not depend on cloud AI.

## AI workflow: privacy, key safety, and limitations

AI is optional. Direct Regiona processing (decode, palette reduction, regions,
vector editing, and SVG export) runs locally in the browser. Choosing an AI
workflow node sends the selected image directly from the browser to Gemini using
the user's own API key; Regiona has no backend proxy and does not receive or
hold that key.

This is a BYOK convenience feature, **not a secure credential vault**:

- By default, a key is kept only for the current browser session. Choosing
  **Remember on this device** stores it in browser local storage, which is less
  appropriate on shared devices and remains exposed to the normal risks of a
  browser environment (for example, malicious extensions or script injection).
- Use a separate, restricted, low-budget key. Do not enter an organization,
  shared, or high-value production key.
- Do not enable remembering on a shared computer; clear the key when finished.
- API usage, billing, provider retention, quotas, and latency are governed by
  the AI provider and the user's account.

AI results are candidates, not authoritative edits. They may fail, be slow,
vary across runs, or change small visual details. In particular, **AI upscale**
is an AI-generated high-resolution candidate rather than guaranteed
pixel-faithful super-resolution, so it may not align exactly with the source.
Review and explicitly adopt a candidate before using it as the Regiona vector
source. Regiona's final palette, regions, editing, and SVG geometry remain
deterministic after a source is chosen.

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

For local-only Regiona processing, image data stays in the browser. This
prototype has no Regiona backend. When an AI workflow node is run, its input
image is sent directly to Gemini from the browser using the user's key.

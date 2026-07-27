# Implementation Plan: spatial region simplification

## Overview

Reduce unnecessary connected components before paths, previews, and selection data are created. The goal is fewer independently editable regions without flattening deliberate high-contrast details.

## Architecture decisions

- Keep the workflow fully local and deterministic; do not introduce a remote AI dependency for the MVP.
- Apply cleanup after colour quantization and before `buildRegions` / path tracing.
- Use original-image colour and local edge strength only as merge guards, not as a source of new colours.
- Make simplification iterative so adjoining tiny components can be resolved after each merge.
- Measure quantization, simplification, region build, and path tracing separately.

## Task list

### Phase 1: Baseline and contract

- [ ] Add a reconstruction benchmark fixture that reports stage timing, region count, and retained-pixel error.
- [ ] Define a `regionSimplification` level with stable, image-size-aware thresholds.
- [ ] Add tests that distinguish noise specks from small high-contrast detail.

### Phase 2: Spatial cleanup

- [ ] Replace one-pass tiny-component replacement with iterative component merging.
- [ ] Score each candidate neighbour by shared edge, palette colour distance, and original-image edge barrier.
- [ ] Stop when no component qualifies or a bounded pass count is reached.

### Phase 3: Product controls and guardrails

- [ ] Replace the pixel-only cleanup control with Off / Subtle / Balanced / Strong simplification.
- [ ] Display final region count and processing time after regeneration.
- [ ] Keep the existing advanced pixel-area control only if testing shows it provides useful independent value.

## Checkpoint

- [ ] Region count is materially lower on the supplied noisy images.
- [ ] Tiny low-contrast noise is merged while isolated high-contrast details remain.
- [ ] Processing and selection interaction improve against the same image baseline.
- [ ] Tests, lint, typecheck, and production build pass.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Removing meaningful small details | Penalize merges across strong original-image edges; offer an Off level. |
| Large images still take too long | Run in the existing reconstruction worker and measure each stage. |
| Control is hard to understand | Expose intent-based presets, with a concise description and final region count. |

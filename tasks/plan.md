# Phase 2: shared-boundary foundation

## Goal

Introduce one canonical raster-boundary model for every pair of touching
regions (and for region-to-canvas edges). This is the data foundation for
shared curve fitting and topology validation in the Regiona design document.

## Scope for this increment

1. Define stable, serializable shared-boundary types.
2. Extract every interior and outer grid edge exactly once from the region label
   map.
3. Build a bidirectional region adjacency graph from those boundaries.
4. Include the boundary and adjacency collections in `ReconstructionResult`.
5. Prove the model with focused unit and reconstruction-pipeline tests.

## Deliberate non-goals

- Do not replace the existing independent region paths yet.
- Do not change SVG export or the current canvas rendering.
- Curve fitting, merge/split/delete, and topology validation follow once this
  canonical boundary data is available.

## Acceptance criteria

- Two adjacent regions share a single boundary record, not two copies.
- Every outer canvas edge is represented once for its owning region.
- Boundary identifiers are deterministic and use region identifiers.
- Every interior boundary is reflected bidirectionally in the adjacency graph.
- Existing reconstruction and color-editing behaviour remains unchanged.

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
4. Convert contiguous collinear grid edges into exact shared line segments.
5. Record measurable fit error with the boundary geometry.
6. Fit cubic Bézier candidates only when they stay within a configurable error
   limit; otherwise retain exact line segments.
7. Validate contour continuity, closure state, and self-intersections before
   boundary geometry can be used for SVG.
8. Assemble valid shared boundary contours into SVG region paths, with a safe
   fallback to the deterministic raster paths.
9. Include the boundary and adjacency collections in `ReconstructionResult`.
10. Preserve those collections in exported Regiona project JSON.
11. Prove the model with focused unit and reconstruction-pipeline tests.

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
- Collinear raster edges are represented by one exact line segment with zero
  fitting error.
- A cubic Bézier is emitted only when its measured maximum error is within the
  configured tolerance; exact lines remain the fallback.
- Boundary topology records whether every contour is continuous, closed, and
  free of self-intersections.
- SVG region paths use approved shared line and cubic geometry; invalid
  topology falls back to the deterministic region path.
- Regiona project JSON preserves boundaries, their vector geometry, and
  adjacency data.
- Existing reconstruction and color-editing behaviour remains unchanged.

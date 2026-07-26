# Phase 2 checklist

- [x] Agree the first increment: adjacency and shared raster boundaries.
- [x] Add boundary contracts and focused failing tests.
- [x] Implement canonical shared-boundary extraction.
- [x] Attach boundaries to reconstruction output.
- [x] Run test, lint, typecheck, and production build.
- [x] Commit and push the verified increment.

## Next increment: curve-fitting contract

- [x] Build and serialize the bidirectional region adjacency graph.
- [x] Define line and cubic Bézier segment contracts with fit-error measurements.
- [x] Convert shared raster edges into ordered, fit-ready contours.
- [x] Add deterministic line fitting and measured error tests.
- [x] Preserve shared boundary geometry and adjacency in project JSON exports.
- [x] Add cubic Bézier fitting with a configurable error limit.

## Next increment: topology validation

- [x] Validate contour continuity and record closed-boundary state.
- [x] Detect self-intersections before SVG geometry uses a boundary.

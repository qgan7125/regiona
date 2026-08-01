# Regiona — Detailed Design Specification

## 0. Document Status

**Project name:** Regiona  
**Document type:** Product and technical design specification  
**Primary output:** Structured, editable SVG  
**Primary concept:** AI-assisted image reconstruction  
**Architecture style:** Region-first reconstruction with deterministic geometry generation  

Regiona is a browser-based image reconstruction tool that converts raster images into structured, editable SVG documents.

Regiona is not designed as a conventional image tracer.

Traditional raster-to-vector tools usually follow this workflow:

```text
Raster image
→ Color reduction
→ Per-color masks
→ Contour tracing
→ Path simplification
→ SVG
```

That approach often produces:

- Excessive path counts
- Jagged or unstable curves
- Duplicate boundaries between adjacent colors
- Small gaps and overlaps
- Unclear object structure
- Same-color objects merged into one path
- Poor editability
- Results that look acceptable but are difficult to modify

Regiona instead reconstructs the image as a set of persistent visual regions, shared boundaries, strokes, layers, and geometric shapes.

The central workflow is:

```text
Raster image
→ Visual analysis
→ Region proposals
→ Region identity model
→ Shared boundary reconstruction
→ Stroke and fill classification
→ Curve fitting
→ Topology validation
→ Structured editable SVG
```

The core product principle is:

> Reconstruct visual structure instead of mechanically tracing pixel boundaries.

---

# 1. Product Vision

Regiona helps users turn flattened raster artwork into SVG documents that are easier to inspect, recolor, reorganize, and edit.

The target input is not limited to one visual category.

Regiona should support:

- Flat illustrations
- Landscapes
- Anime and cartoon artwork
- Posters
- Logos
- Icons
- Animals
- Architecture
- Stylized photographs
- AI-generated images
- Line art
- Mixed graphic compositions

The system should not assume that the image contains people, characters, or semantic objects that can always be named.

Instead, Regiona should treat the image as a composition of visual regions.

Examples of visual regions include:

- A sky area
- A cloud
- A mountain
- A face
- A shirt
- A patch of shadow
- A lake reflection
- A building facade
- A logo letter
- A tree canopy
- A highlight
- A line-art stroke

The system may assign semantic labels when AI confidence is high, but semantic understanding is optional.

Region identity must not depend on semantic labels.

---

# 2. Product Positioning

Regiona is not primarily:

- A 3D printing tool
- A CAD tool
- A manufacturing preparation tool
- A bitmap filter
- A generic photo editor
- A one-click auto-trace wrapper
- A text-to-image generator
- A text-to-SVG generator

Regiona is:

> An AI-assisted visual reconstruction editor that converts raster images into independent, editable visual regions and structured SVG geometry.

The defining product difference is:

```text
Color is an appearance property.
Region is an editable object.
Boundary is a geometric relationship.
Shape is the vector representation.
```

Two regions may have the same color and still remain separate editable objects.

Two neighboring regions may use the same shared boundary while remaining independent.

---

# 3. Core Principles

## 3.1 Region-First Model

The primary unit is a visual region, not a palette color and not an SVG path.

A region represents one editable part of the composition.

Examples:

```text
left mountain
right mountain
cloud 1
cloud 2
foreground tree
lake highlight
shirt shadow
left eye
right eye
```

A region may be unnamed.

```text
region-00023
region-00024
```

Naming is optional; identity is mandatory.

## 3.2 Color Equality Does Not Imply Object Identity

Two regions with the same fill color must not be merged automatically.

For example:

```text
black hair
black eye
black shoes
black outline
```

All may use `#1E1E1E`, but they must remain independently selectable and recolorable.

Changing one region’s color must not change its topology or merge it with neighboring geometry.

## 3.3 Palette Merge Is Not Geometry Merge

Color normalization may map several similar raster colors to one palette color.

Example:

```text
#1F2020
#202020
#222121
→ #202020
```

This operation may update `colorId` references.

It must not union region geometry.

## 3.4 AI Proposes; Deterministic Engines Apply

AI is used for:

- Image classification
- Structure suggestions
- Region proposals
- Object or area selection
- Layer suggestions
- Semantic naming
- Reconstruction recommendations
- Texture simplification suggestions
- Natural-language edit translation

AI must not be the final source of SVG geometry.

Final geometry must come from deterministic algorithms with measurable error and validation.

## 3.5 Geometry Must Be Reproducible

Given:

- The same source image
- The same accepted AI proposals
- The same settings
- The same region edits

Regiona should generate the same SVG geometry.

## 3.6 Editability Is a First-Class Requirement

The default SVG output must preserve:

- Independent regions
- Stable region IDs
- Logical groups
- Fill and stroke roles
- Layer order
- Metadata
- Region-level recoloring capability

Optimization and flattening must be explicit export choices.

## 3.7 Image Reconstruction Is Style-Dependent

A flat illustration and a landscape photograph cannot use the same assumptions.

Regiona must support reconstruction styles rather than one universal tracing pipeline.

---

# 4. Supported Reconstruction Styles

## 4.1 Flat Region

Designed for:

- Logos
- Icons
- Flat anime artwork
- Cartoons
- Graphic illustrations
- Posterized artwork

Characteristics:

- Discrete colors
- Hard region boundaries
- Minimal overlap
- Strong region identity
- No gradients by default
- High SVG editability

## 4.2 Layered Illustration

Designed for:

- Landscapes
- Painted illustrations
- Stylized scenes
- Artwork with shadows and highlights
- Semi-flat compositions

Characteristics:

- Overlapping shapes
- Base regions plus shadow and highlight layers
- Optional opacity
- Optional limited gradients
- Explicit layer order
- Independent visual components

## 4.3 Posterized

Designed for:

- Photographs converted into graphic art
- Simplified landscapes
- High-contrast portraits
- Stylized visual output

Characteristics:

- Controlled palette
- Simplified shapes
- Reduced texture
- Strong silhouette preservation
- Large visual regions
- Limited shape count

## 4.4 Line Art

Designed for:

- Black-and-white drawings
- Technical sketches
- Ink-style art
- Coloring-book images
- Logo outlines

Characteristics:

- Stroke reconstruction
- Centerline extraction
- Width estimation
- Optional stroke expansion
- Minimal filled regions

## 4.5 Mixed

Designed for images containing combinations of:

- Filled areas
- Line art
- Gradients
- Texture clusters
- Text
- Layered highlights

Mixed mode may combine several reconstruction strategies.

---

# 5. High-Level Workflow

```text
Upload image
→ Decode and normalize
→ Analyze image complexity
→ Recommend reconstruction style
→ Generate palette and luminance representation
→ Produce candidate visual regions
→ Apply AI-assisted region proposals
→ Build persistent region identities
→ Construct region adjacency graph
→ Extract shared boundaries
→ Classify fill, stroke, texture, and background roles
→ Infer layer and overlap relationships
→ Reconstruct curves
→ Validate and repair topology
→ Allow user corrections
→ Generate structured SVG
→ Export project metadata and optional optimized SVG
```

The cleaned raster preview is an intermediate representation.

It is not the source of truth.

The source of truth is the Regiona project model.

---

# 6. Primary User Workflow

## 6.1 Import

1. User uploads an image.
2. Regiona decodes the image locally.
3. Regiona displays:
   - Dimensions
   - Alpha presence
   - Estimated visual complexity
   - Estimated color complexity
   - Edge density
   - Texture density
   - Gradient density
   - Recommended reconstruction style

## 6.2 Configure

The user chooses or accepts:

- Reconstruction style
- Target palette size
- Detail budget
- Gradient policy
- Texture policy
- Shape budget
- Node budget
- Curve fitting tolerance
- AI assistance level

## 6.3 Analyze

Regiona runs deterministic analysis and optional AI analysis.

The user sees:

- Palette
- Suggested regions
- Region boundaries
- Stroke candidates
- Texture clusters
- Suggested layers
- AI confidence indicators

## 6.4 Confirm or Correct

The user can:

- Accept all proposals
- Accept selected proposals
- Reject proposals
- Split a region
- Merge selected regions
- Recolor a region
- Mark a region as protected
- Mark a region as fill
- Mark a region as stroke
- Change layer order
- Refit a local boundary

## 6.5 Reconstruct

Regiona generates vector geometry using deterministic algorithms.

## 6.6 Review

The user reviews:

- Original image
- Region map
- Layer map
- Vector preview
- Boundary preview
- Node preview
- Difference overlay
- AI proposal history

## 6.7 Export

The user exports:

- Editable SVG
- Optimized SVG
- Flattened SVG
- Regiona project JSON
- Palette JSON
- Region preview PNG
- Reconstruction report JSON

---

# 7. AI Integration Strategy

## 7.1 AI Responsibilities

AI may assist with:

- Image type classification
- Reconstruction style recommendation
- Semantic area proposals
- Object or visual-region selection
- Region naming
- Region grouping
- Layer order proposals
- Texture interpretation
- Natural-language command translation
- Suggested simplification levels
- Suggested protected regions

## 7.2 AI Non-Responsibilities

AI must not directly own:

- Final SVG path data
- Shared boundary coordinates
- Polygon validity
- Curve-fitting error enforcement
- Closed-path guarantees
- Self-intersection validation
- Hole hierarchy
- Deterministic region union
- Final export integrity

## 7.3 AI Proposal Lifecycle

All AI outputs must be represented as proposals.

```ts
interface AiProposal {
  id: string;

  type:
    | "image-classification"
    | "reconstruction-settings"
    | "region-mask"
    | "region-label"
    | "region-group"
    | "layer-order"
    | "stroke-classification"
    | "texture-classification"
    | "simplification"
    | "edit-command";

  confidence: number;

  targetRegionIds?: string[];
  proposedMaskId?: string;
  proposedValue: unknown;

  source:
    | "cloud-multimodal"
    | "local-segmentation"
    | "local-classifier";

  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "modified";
}
```

AI proposals must never silently overwrite project state.

## 7.4 AI Assistance Levels

### Off

No AI calls.

Only deterministic image processing is used.

### Suggest

AI provides recommendations and proposals.

The user confirms changes.

### Guided

High-confidence proposals may be preselected for acceptance, but the user still confirms the reconstruction.

### Automatic

May be considered later.

Not part of the MVP.

## 7.5 User-Composable Image Workflows

Regiona supports two entry modes:

- **Start with Regiona**: upload an image and proceed directly to deterministic quantization, region editing, vector review, and export.
- **Build a workflow**: upload into a visual graph and branch into AI and analysis tasks before selecting an image for Regiona vector processing.

The entry choice is reversible. A direct Regiona project can open a workflow using its current source as the Start image. A workflow can open the Regiona editor when it has one current, non-stale image selected for vector processing. Changing modes alone must never replace image data.

### 7.5.1 Workflow Nodes

Version one exposes a fixed catalogue of typed nodes. Users may add, remove, duplicate, arrange, and connect compatible nodes, but cannot create arbitrary executable code nodes or invalid dependency cycles.

| Node | Input | Output | Notes |
| --- | --- | --- | --- |
| Start | User-uploaded image | Original image | The workflow's immutable reference image. |
| Analyze | Original or generated image | AI proposal/report | Reports quality, image type, likely vectorization problems, suggested colour/detail budgets, and warnings. It does not silently change settings. |
| AI clean redraw | Original image | Cleaned image | Removes non-semantic texture and noisy fragments while preserving composition. |
| Black line art | Original image | Black-on-white line-art image | A direct candidate for Regiona vector processing; does not require redraw or colorization. |
| Apply source colours | Original image + clean redraw + optional current target palette | Colour reconstruction | Reapplies semantic colour onto clean geometry. |
| Regiona vector | One explicit current image candidate | Editable Regiona project | Runs local quantization, regions, vector editing, review, and export. |

Nodes show a compact execution summary. Clicking a node opens a dedicated inspector: image-producing nodes use linked original/output comparison; Analyze uses a readable proposal report. Detailed image interaction belongs in the inspector, not inside the graph card.

### 7.5.2 Execution and Revisions

Each node output has a revision and one of these states:

```ts
type WorkflowNodeStatus =
  | "idle"
  | "ready"
  | "running"
  | "complete"
  | "stale"
  | "error";
```

Rerunning an image-producing node creates a new output revision and marks only its descendants stale. The previous result remains reviewable, but stale results cannot be automatically run downstream or selected for Regiona vector processing until their current inputs are recomputed.

The workflow provides:

- **Run node / Regenerate** for the selected task.
- **Run ready nodes** to execute all enabled nodes with current inputs in dependency order.
- **Run to Regiona vector** to execute one user-selected valid path, rather than every branch.
- **Cancel current run** to prevent queued work from starting; late provider responses are ignored if their revision is no longer current.

Selecting an AI image for Regiona vector processing requires confirmation. Confirming resets regions, selections, palette edits, vector edits, and undo/redo history because they belong to the previous source geometry. Cancelling changes nothing. AI output must never be auto-adopted.

### 7.5.3 Workflow UI Boundary

The graph is a visualization and interaction layer. Workflow dependency validation, execution ordering, revisions, stale-state calculation, and adoption eligibility live in Regiona's own pure workflow model so they are deterministic and unit-testable.

The graph implementation may use React Flow custom nodes and typed handles. Its graph viewport is separate from the linked Pixi image-comparison viewport so pan and zoom interactions do not compete.

---

# 8. Privacy and Deployment Model

## 8.1 Local Processing

The following should run locally when practical:

- Image decode
- Color analysis
- Palette creation
- Connected components
- Label map
- Morphology
- Contour extraction
- Curve fitting
- SVG generation
- Topology validation
- Project editing

## 8.2 Cloud AI

Cloud AI may be used for:

- High-level image understanding
- Semantic segmentation assistance
- Natural-language edits
- Region naming
- Layer inference

If cloud AI is enabled:

- The user must be informed before image upload.
- The UI must distinguish local and cloud processing.
- Application-owned API credentials must not be exposed in browser code.
- A bring-your-own-key (BYOK) mode may send a user-provided provider key directly from the browser only when the provider explicitly supports browser requests. The key must never be committed, logged, embedded in deployed assets, or sent to a Regiona backend.
- A hosted/shared-key mode must use a secure backend or serverless proxy.
- AI use must be optional.
- Local-only mode must remain available.

## 8.3 Deployment Phases

### MVP

```text
Browser application
+
Optional minimal AI proxy
```

### Later

```text
Browser application
+
AI gateway
+
Usage accounting
+
Model routing
+
Project sync
```

---

# 9. Core Data Model

## 9.1 Project

```ts
interface RegionaProject {
  id: string;
  version: string;

  source: SourceImage;
  settings: ReconstructionSettings;

  palette: PaletteColor[];
  labelMap: LabelMapReference;

  regions: VisualRegion[];
  boundaries: SharedBoundary[];
  strokes: StrokePath[];
  textureClusters: TextureCluster[];
  shapes: VectorShape[];
  groups: RegionGroup[];
  layers: CompositionLayer[];

  aiProposals: AiProposal[];
  editHistory: ProjectOperation[];

  svgDocument?: SvgDocumentModel;
}
```

## 9.2 Source Image

```ts
interface SourceImage {
  id: string;
  filename: string;
  mimeType: string;

  widthPx: number;
  heightPx: number;
  aspectRatio: number;

  hasAlpha: boolean;
  colorProfile?: string;

  checksum: string;
}
```

## 9.3 Palette Color

```ts
interface PaletteColor {
  id: string;
  index: number;

  hex: string;
  rgba: [number, number, number, number];

  sourceColorCount: number;
  pixelCount: number;
  percentage: number;

  locked: boolean;
  visible: boolean;

  name?: string;
}
```

## 9.4 Visual Region

```ts
type RegionRole =
  | "background"
  | "fill"
  | "shadow"
  | "highlight"
  | "outline"
  | "stroke"
  | "texture"
  | "detail"
  | "unknown";

interface VisualRegion {
  id: string;

  colorId: string;
  sourceComponentIds: number[];

  shapeIds: string[];
  boundaryIds: string[];

  bounds: Rect;
  pixelArea: number;

  role: RegionRole;
  label?: string;

  layerId?: string;
  groupIds: string[];

  protected: boolean;
  locked: boolean;
  visible: boolean;

  origin:
    | "deterministic"
    | "ai-proposed"
    | "user-created"
    | "split"
    | "merged";
}
```

## 9.5 Shared Boundary

```ts
type CurveSegment =
  | LineSegment
  | ArcSegment
  | QuadraticBezierSegment
  | CubicBezierSegment;

interface SharedBoundary {
  id: string;

  regionAId: string;
  regionBId?: string;

  rasterPoints: Point[];
  vectorSegments: CurveSegment[];

  closed: boolean;
  locked: boolean;

  maximumFitErrorPx: number;
  averageFitErrorPx: number;

  source:
    | "region-adjacency"
    | "outer-edge"
    | "user-drawn";
}
```

## 9.6 Vector Shape

```ts
interface VectorShape {
  id: string;
  regionId: string;

  outerBoundaryIds: string[];
  holeBoundaryIds: string[];

  fill?: PaintStyle;
  stroke?: StrokeStyle;

  zIndex: number;
  opacity: number;

  geometryRole:
    | "filled-area"
    | "stroke-centerline"
    | "stroke-expanded"
    | "texture-mark";
}
```

## 9.7 Stroke Path

```ts
interface StrokePath {
  id: string;
  regionId: string;

  centerline: CurveSegment[];
  widthProfile: StrokeWidthSample[];

  averageWidthPx: number;
  widthVariation: number;

  cap: "round" | "square" | "butt";
  join: "round" | "miter" | "bevel";

  expandedShapeId?: string;
}
```

## 9.8 Texture Cluster

```ts
interface TextureCluster {
  id: string;
  regionId: string;

  sourceComponentIds: number[];

  representation:
    | "simplified-shapes"
    | "scatter"
    | "pattern"
    | "merged-silhouette"
    | "discarded";

  detailLevel:
    | "minimal"
    | "balanced"
    | "detailed";

  maximumShapeCount: number;
}
```

## 9.9 Region Group

```ts
interface RegionGroup {
  id: string;
  name: string;

  type:
    | "semantic"
    | "color"
    | "layer"
    | "custom";

  regionIds: string[];
}
```

## 9.10 Composition Layer

```ts
interface CompositionLayer {
  id: string;
  name: string;

  regionIds: string[];
  zIndex: number;

  visible: boolean;
  locked: boolean;
  opacity: number;
}
```

---

# 10. Reconstruction Settings

```ts
type ReconstructionStyle =
  | "flat"
  | "layered"
  | "posterized"
  | "line-art"
  | "mixed";

type DetailBudget =
  | "minimal"
  | "balanced"
  | "detailed"
  | "custom";

interface ReconstructionSettings {
  style: ReconstructionStyle;
  detailBudget: DetailBudget;

  targetColors: number;

  preserveTransparency: boolean;
  preserveGradients: boolean;
  preserveTextureClusters: boolean;

  maximumShapeCount: number;
  maximumNodeCount: number;

  minimumRegionAreaPx: number;
  maximumHoleAreaPx: number;

  curveFitTolerancePx: number;
  cornerDetectionSensitivity: number;

  preferLines: boolean;
  detectArcs: boolean;
  detectStrokes: boolean;

  allowOverlappingLayers: boolean;

  aiAssistance:
    | "off"
    | "suggest"
    | "guided";
}
```

Suggested limits:

| Setting | Minimum | Maximum |
|---|---:|---:|
| Target colors | 2 | 64 |
| Maximum shapes | 10 | 10,000 |
| Maximum nodes | 100 | 250,000 |
| Curve tolerance | 0.25 px | 20 px |

The UI may expose simpler presets while keeping advanced settings collapsible.

---

# 11. Image Analysis

After upload, Regiona calculates:

- Width and height
- Transparency percentage
- Estimated source color count
- Estimated palette complexity
- Edge density
- Gradient density
- Texture density
- Connected-component estimate
- Stroke-likeness estimate
- Foreground/background separability
- Image complexity score
- Recommended reconstruction style
- Recommended palette size
- Recommended detail budget

Example:

```ts
interface ImageAnalysis {
  widthPx: number;
  heightPx: number;
  aspectRatio: number;

  hasAlpha: boolean;
  transparentPercentage: number;

  estimatedColorCount: number;
  estimatedRegionCount: number;

  edgeDensity: number;
  gradientDensity: number;
  textureDensity: number;
  strokeDensity: number;

  complexityScore: number;

  recommendedStyle: ReconstructionStyle;
  recommendedTargetColors: number;
  recommendedDetailBudget: DetailBudget;

  warnings: ImageAnalysisWarning[];
}
```

Possible warnings:

- Smooth gradients will be simplified.
- Dense foliage may produce many shapes.
- The source contains heavy compression artifacts.
- The image has weak boundaries.
- The image may require AI-assisted segmentation.
- The image may be unsuitable for flat reconstruction.

---

# 12. Color and Tone Processing

## 12.1 Purpose

Color processing supports region reconstruction.

It is not allowed to define object identity by itself.

## 12.2 Color Space

Use LAB or OKLab for perceptual color distance.

Possible supporting spaces:

- RGB for image buffers
- LAB or OKLab for clustering
- LCH for palette controls
- Grayscale or luminance for tone segmentation

## 12.3 Palette Generation

Recommended pipeline:

```text
Sample source pixels
→ Remove fully transparent pixels
→ Convert samples to perceptual color space
→ Generate candidate palette
→ Apply locked colors
→ Assign all pixels to palette entries
→ Produce palette-index label image
```

Supported methods:

- K-Means
- Median Cut
- Octree
- Hybrid quantization
- User-provided palette

## 12.4 Gradient Handling

Depending on reconstruction style:

### Flat

Convert gradients into discrete tone regions.

### Layered

Represent gradients using:

- Base region
- One or more translucent overlay regions
- Optional SVG gradient where appropriate

### Posterized

Reduce gradients to broad bands.

### Line Art

Ignore fill gradients unless required for background removal.

## 12.5 Palette Merge Rules

Palette merge:

- Changes region `colorId`
- Preserves region IDs
- Preserves shapes
- Preserves group membership
- Preserves boundaries
- Does not union geometry

---

# 13. Region Generation

## 13.1 Deterministic Candidate Regions

Initial regions may be created from:

- Connected components
- Watershed segmentation
- Superpixels
- Edge-constrained flood fill
- Palette-index regions
- Luminance segmentation
- Alpha segmentation

## 13.2 AI Candidate Regions

AI may propose masks for:

- Named objects
- Visual groups
- Background
- Foreground
- Texture areas
- Similar structures
- User-clicked or described targets

## 13.3 Region Reconciliation

Candidate masks may overlap or conflict.

Regiona must reconcile them using:

- User acceptance state
- Confidence
- Edge alignment
- Region containment
- Layer model
- Existing protected regions
- Deterministic pixel evidence

## 13.4 Region Identity Rules

Default rules:

1. Disconnected components remain separate.
2. Same-color disconnected regions never merge automatically.
3. Recoloring does not change region identity.
4. Palette merging does not change region identity.
5. Adjacent same-color regions remain separate when a semantic or user boundary exists.
6. Same-color connected raster areas may require manual or AI-assisted splitting.
7. User merges are explicit and reversible.
8. Every split creates new stable region IDs.
9. Every merge records source region IDs.

---

# 14. Region Adjacency Graph

Regiona must construct an adjacency graph.

```ts
interface RegionAdjacency {
  regionAId: string;
  regionBId: string;

  sharedBoundaryPixelCount: number;
  sharedBoundaryId?: string;

  relationship:
    | "adjacent"
    | "overlapping"
    | "contains"
    | "contained-by"
    | "occludes"
    | "unknown";
}
```

The graph supports:

- Shared boundary extraction
- Layer inference
- Merge suggestions
- Split suggestions
- Selection expansion
- Topology validation
- Grouping

---

# 15. Shared Boundary Reconstruction

## 15.1 Requirement

Adjacent planar regions must use one shared geometric boundary.

Do not independently fit both sides of the same raster edge.

Incorrect:

```text
Region A contour fitted independently
Region B contour fitted independently
```

Correct:

```text
A–B raster boundary
→ Fit once
→ SharedBoundary
→ Referenced by both regions
```

## 15.2 Benefits

- No gaps
- No overlap caused by duplicate fitting
- Stable planar SVG
- Easier recoloring
- Easier topology repair
- Consistent local edits

## 15.3 Outer Boundaries

Image edges and transparent-background borders become outer boundaries with only one attached region.

## 15.4 Boundary Locking

Users may lock a boundary to prevent automatic refitting.

---

# 16. Curve Reconstruction

## 16.1 Pipeline

```text
Raster boundary
→ Remove duplicate points
→ Smooth high-frequency pixel noise
→ Detect corners
→ Segment boundary
→ Classify segment geometry
→ Fit line, arc, quadratic, or cubic Bézier
→ Measure error
→ Split and refit where required
→ Validate continuity
```

## 16.2 Geometry Types

### Line

Use when deviation is below line tolerance.

### Arc

Use for circular or near-circular structures.

### Quadratic Bézier

Use for simple smooth curvature.

### Cubic Bézier

Use for general freeform curves.

## 16.3 Error Metrics

Track:

- Maximum point-to-curve distance
- Average point-to-curve distance
- Area difference
- Corner displacement
- Tangent discontinuity
- Curvature discontinuity

## 16.4 Corner Preservation

Important corners must not be smoothed away.

Examples:

- Building corners
- Logo geometry
- Hair tips
- Mountain peaks
- Eye corners
- Leaf points
- Poster typography edges

## 16.5 Refitting

If a segment exceeds tolerance:

1. Find the maximum error point.
2. Split the segment.
3. Refit both sides.
4. Repeat until valid or node budget is reached.

---

# 17. Stroke Reconstruction

## 17.1 Stroke Candidate Detection

A region may be stroke-like when it has:

- High length-to-width ratio
- Consistent local thickness
- Skeleton-like topology
- Open visual appearance
- Line-art adjacency behavior
- Low enclosed area relative to perimeter

## 17.2 Stroke Pipeline

```text
Stroke-like raster region
→ Skeletonization
→ Branch cleanup
→ Centerline simplification
→ Width estimation
→ Cap and join inference
→ SVG stroke generation
```

## 17.3 Output Choices

### Editable Stroke

```xml
<path
  fill="none"
  stroke="#111111"
  stroke-width="8"
  d="..."
/>
```

### Expanded Stroke

Convert stroke into a closed filled outline.

Editable stroke is preferred for general SVG editing.

Expanded stroke may be selected for compatibility.

---

# 18. Texture Reconstruction

## 18.1 Problem

Landscapes and complex illustrations may contain thousands of small texture marks.

Examples:

- Leaves
- Grass
- Water reflections
- Rock texture
- Snow
- Clouds
- Hair strands
- Surface noise

Preserving all components produces unusable SVG.

Deleting all components removes important visual character.

## 18.2 Texture Budget

Texture reconstruction must use a configurable budget.

```ts
interface TextureBudget {
  maximumClusters: number;
  maximumMarksPerCluster: number;
  minimumMarkAreaPx: number;
  preserveContrastThreshold: number;
}
```

## 18.3 Texture Strategies

### Simplified Shapes

Keep a limited number of high-value texture marks.

### Scatter

Represent repeated marks as lightweight repeated elements.

### Pattern

Use an SVG pattern where editability remains acceptable.

### Merged Silhouette

Merge texture into the main region outline.

### Discard

Remove low-value texture.

## 18.4 Selection Priority

Prefer marks with:

- High local contrast
- Large visual area
- Strong directional structure
- Important silhouette contribution
- User protection
- AI importance recommendation

---

# 19. Layer and Occlusion Model

## 19.1 Planar Model

Regions tile the visible plane.

Best for:

- Logos
- Flat illustrations
- Posterized art
- Hard-edged graphics

## 19.2 Layered Model

Shapes overlap.

Best for:

- Landscapes
- Characters
- Shadows
- Highlights
- Clouds
- Reflections
- Decorative overlays

## 19.3 Layer Inference

Layer order may come from:

- Containment
- T-junctions
- Transparency
- AI proposals
- Existing outline relationships
- User edits

## 19.4 Confidence

Layer relationships should include confidence.

```ts
interface LayerRelation {
  belowRegionId: string;
  aboveRegionId: string;

  confidence: number;

  source:
    | "geometry"
    | "ai"
    | "user";
}
```

Low-confidence relationships should be surfaced for review.

---

# 20. User Editing Model

## 20.1 Region Editing

Users can:

- Select a region
- Multi-select regions
- Rename
- Recolor
- Hide
- Lock
- Protect
- Delete
- Duplicate
- Merge selected regions
- Split a region
- Move to layer
- Assign role
- Convert fill to stroke candidate
- Convert stroke to fill

## 20.2 Boundary Editing

Users can:

- Select boundary
- Smooth
- Reduce nodes
- Preserve corner
- Fit line
- Fit arc
- Fit Bézier
- Lock
- Unlock
- Redraw local section
- Adjust curve handles

## 20.3 Layer Editing

Users can:

- Reorder layers
- Move regions between layers
- Create groups
- Set opacity
- Hide layer
- Lock layer
- Flatten selected layers

## 20.4 AI-Assisted Editing

Users may issue commands such as:

```text
Select all clouds.
Simplify the distant mountains.
Keep the tree silhouettes but remove most leaf texture.
Separate the two gray mountains.
Make the lake reflections independent regions.
Reduce the internal shadows in the clouds.
```

AI translates the command into a structured operation proposal.

The user previews and applies it.

---

# 21. Operation and History Model

Every structural edit must be reversible.

```ts
type ProjectOperation =
  | SplitRegionOperation
  | MergeRegionsOperation
  | RecolorRegionOperation
  | DeleteRegionOperation
  | UpdateBoundaryOperation
  | MoveRegionLayerOperation
  | AcceptAiProposalOperation
  | RejectAiProposalOperation
  | ChangeRoleOperation;
```

Each operation includes:

```ts
interface BaseProjectOperation {
  id: string;
  timestamp: number;
  type: string;

  affectedRegionIds: string[];
  reversible: boolean;
}
```

Undo and redo are required for region and boundary edits.

---

# 22. SVG Document Model

## 22.1 Editable SVG

Default export.

Goals:

- Independent paths
- Stable region IDs
- Logical layer groups
- Metadata
- Easy recoloring
- No automatic union by color

Example:

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 2048 2048"
>
  <metadata>
    Regiona project metadata
  </metadata>

  <g id="layer-background">
    <path
      id="region-sky"
      data-region-id="region-sky"
      data-role="background"
      fill="#8CB7D9"
      d="..."
    />
  </g>

  <g id="layer-midground">
    <path
      id="region-mountain-left"
      data-region-id="region-mountain-left"
      fill="#50636C"
      d="..."
    />

    <path
      id="region-mountain-right"
      data-region-id="region-mountain-right"
      fill="#50636C"
      d="..."
    />
  </g>
</svg>
```

The two mountains remain separate even though their colors match.

## 22.2 Optimized SVG

Optional export.

May:

- Remove metadata
- Collapse empty groups
- Simplify IDs
- Merge only explicitly mergeable shapes
- Reduce redundant attributes

It must not automatically union all same-color regions unless selected by the user.

## 22.3 Flattened SVG

Optional export.

May:

- Remove hidden geometry
- Resolve overlap
- Union selected same-color geometry
- Remove edit metadata
- Prioritize final visual appearance and file size

## 22.4 SVG Metadata

Suggested attributes:

- `data-region-id`
- `data-role`
- `data-color-id`
- `data-layer-id`
- `data-group-ids`
- `data-origin`
- `data-protected`

## 22.5 SVG Compatibility

Test with:

- Web browsers
- Inkscape
- Adobe Illustrator
- Affinity Designer
- Figma import
- Blender SVG import

---

# 23. User Interface

## 23.1 Desktop Layout

```text
┌──────────────────┬──────────────────────────────┬──────────────────┐
│ Project / Tools  │ Main Preview                 │ Inspector        │
│                  │                              │                  │
│ Upload           │ Original                     │ Region details   │
│ Reconstruction   │ Region map                   │ Fill/stroke      │
│ AI proposals     │ Vector preview               │ Layer            │
│ Layers           │ Difference overlay           │ Boundaries       │
│ Palette          │ Node preview                 │ AI confidence    │
│ History          │                              │ Export           │
└──────────────────┴──────────────────────────────┴──────────────────┘
```

## 23.2 Primary Views

- Original
- Quantized
- Region Map
- Layer Map
- Vector
- Difference
- Nodes
- AI Proposals

## 23.3 Region Panel

Displays:

- Region ID
- Optional name
- Color
- Role
- Layer
- Area
- Shape count
- Boundary count
- Origin
- Protection status
- AI confidence
- Group membership

## 23.4 Palette Panel

Displays:

- Swatch
- Hex value
- Region count
- Pixel percentage
- Visibility
- Lock
- Recolor action

Palette selection may highlight all regions using the color.

It must not imply they are one object.

## 23.5 AI Proposal Panel

Displays:

- Proposal type
- Description
- Confidence
- Affected area
- Before/after preview
- Accept
- Reject
- Modify

## 23.6 Boundary Inspector

Displays:

- Boundary ID
- Attached regions
- Geometry type
- Segment count
- Node count
- Maximum fit error
- Lock status
- Refit controls

---

# 24. Technology Architecture

## 24.1 Client Stack

```text
React
TypeScript
Vite
PixiJS
OpenCV.js
Web Worker
OffscreenCanvas
ImageBitmap
Browser File API
```

Optional:

```text
ONNX Runtime Web
Transformers.js
WebGPU
```

## 24.2 Optional Backend

Required only for cloud AI.

Possible stack:

```text
TypeScript
Node.js
Serverless functions
AI provider SDK
Object-free request proxy
Rate limiting
Usage logging
```

Images should not be persisted by default.

## 24.3 Responsibility Split

### React

- Application layout
- Serializable project state
- Forms
- Inspector panels
- History controls
- Export actions
- Proposal review

### PixiJS

- Image preview
- Region overlays
- Boundary overlays
- Vector previews
- Selection
- Pan and zoom
- Difference visualization

### Worker

- OpenCV initialization
- Image analysis
- Palette processing
- Region segmentation
- Boundary extraction
- Curve fitting
- Stroke analysis
- Texture analysis
- Topology validation
- SVG generation

### AI Gateway

- Image understanding
- Region proposals
- Semantic naming
- Natural-language command interpretation
- Layer suggestions

---

# 25. Worker Architecture

## 25.1 Worker Responsibilities

The worker owns all heavy deterministic processing.

## 25.2 Message Types

```ts
type WorkerRequest =
  | { type: "INITIALIZE" }
  | {
      type: "ANALYZE_IMAGE";
      requestId: string;
      payload: AnalyzeImagePayload;
    }
  | {
      type: "BUILD_INITIAL_REGIONS";
      requestId: string;
      payload: BuildInitialRegionsPayload;
    }
  | {
      type: "APPLY_REGION_OPERATION";
      requestId: string;
      payload: RegionOperationPayload;
    }
  | {
      type: "RECONSTRUCT_GEOMETRY";
      requestId: string;
      payload: ReconstructGeometryPayload;
    }
  | {
      type: "GENERATE_SVG";
      requestId: string;
      payload: GenerateSvgPayload;
    }
  | {
      type: "CANCEL";
      requestId: string;
    }
  | {
      type: "DISPOSE";
    };
```

```ts
type WorkerResponse =
  | { type: "READY" }
  | {
      type: "PROGRESS";
      requestId: string;
      payload: ProcessingProgress;
    }
  | {
      type: "ANALYSIS_COMPLETE";
      requestId: string;
      payload: ImageAnalysis;
    }
  | {
      type: "REGIONS_COMPLETE";
      requestId: string;
      payload: RegionBuildResult;
    }
  | {
      type: "GEOMETRY_COMPLETE";
      requestId: string;
      payload: GeometryBuildResult;
    }
  | {
      type: "SVG_COMPLETE";
      requestId: string;
      payload: SvgBuildResult;
    }
  | {
      type: "CANCELLED";
      requestId: string;
    }
  | {
      type: "ERROR";
      requestId?: string;
      payload: WorkerError;
    };
```

## 25.3 Transferables

Use:

- `ArrayBuffer`
- `ImageBitmap`
- Shared typed-array views where supported

Avoid cloning full image buffers.

---

# 26. Project Structure

```text
regiona/
├── public/
│   └── opencv/
│       ├── opencv.js
│       └── opencv.wasm
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── app-store.ts
│   │   ├── project-store.ts
│   │   └── routes.ts
│   │
│   ├── components/
│   │   ├── upload/
│   │   ├── reconstruction/
│   │   ├── regions/
│   │   ├── boundaries/
│   │   ├── layers/
│   │   ├── palette/
│   │   ├── ai-proposals/
│   │   ├── preview/
│   │   ├── inspector/
│   │   ├── history/
│   │   └── export/
│   │
│   ├── preview/
│   │   ├── PixiPreviewController.ts
│   │   ├── scene.ts
│   │   ├── image-layer.ts
│   │   ├── region-layer.ts
│   │   ├── boundary-layer.ts
│   │   ├── vector-layer.ts
│   │   ├── selection-layer.ts
│   │   └── difference-layer.ts
│   │
│   ├── workers/
│   │   ├── reconstruction.worker.ts
│   │   ├── worker-client.ts
│   │   └── worker-protocol.ts
│   │
│   ├── engine/
│   │   ├── opencv/
│   │   ├── image/
│   │   ├── analysis/
│   │   ├── color/
│   │   ├── segmentation/
│   │   ├── regions/
│   │   ├── adjacency/
│   │   ├── boundaries/
│   │   ├── curves/
│   │   ├── strokes/
│   │   ├── textures/
│   │   ├── layers/
│   │   ├── topology/
│   │   ├── svg/
│   │   └── project/
│   │
│   ├── ai/
│   │   ├── ai-client.ts
│   │   ├── proposal-parser.ts
│   │   ├── command-schema.ts
│   │   ├── mask-alignment.ts
│   │   └── confidence.ts
│   │
│   ├── operations/
│   │   ├── split-region.ts
│   │   ├── merge-regions.ts
│   │   ├── recolor-region.ts
│   │   ├── delete-region.ts
│   │   ├── refit-boundary.ts
│   │   └── operation-history.ts
│   │
│   ├── presets/
│   │   ├── flat.ts
│   │   ├── layered.ts
│   │   ├── posterized.ts
│   │   ├── line-art.ts
│   │   └── mixed.ts
│   │
│   ├── types/
│   │   ├── project.ts
│   │   ├── image.ts
│   │   ├── palette.ts
│   │   ├── region.ts
│   │   ├── boundary.ts
│   │   ├── shape.ts
│   │   ├── stroke.ts
│   │   ├── texture.ts
│   │   ├── layer.ts
│   │   ├── ai.ts
│   │   └── svg.ts
│   │
│   └── main.tsx
│
├── server/
│   └── ai-proxy/
│       ├── analyze-image.ts
│       ├── propose-regions.ts
│       ├── interpret-command.ts
│       └── rate-limit.ts
│
├── tests/
│   ├── fixtures/
│   ├── unit/
│   ├── integration/
│   ├── visual/
│   └── compatibility/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

# 27. MVP Scope

## 27.1 P0 — Reconstruction Core

Required:

- React + TypeScript + Vite
- Image upload
- Local image decode
- Image analysis
- Palette reduction
- Region label map
- Connected-region generation
- Independent region identities
- Same-color regions preserved independently
- Region recoloring
- Region deletion
- Region merge
- Basic region split
- Region adjacency graph
- Shared boundary extraction
- Line and cubic Bézier fitting
- Closed-path validation
- Self-intersection validation
- Editable SVG export
- PixiJS preview
- Pan and zoom
- Region selection
- Undo and redo
- OpenCV and PixiJS cleanup

## 27.2 P1 — AI Assistance

- Image classification
- Reconstruction style recommendation
- Semantic region proposals
- Click-assisted region selection
- Region naming
- Layer suggestions
- AI proposal review
- Natural-language edit commands
- Cloud AI opt-in

## 27.3 P1 — Editing Improvements

- Local boundary refitting
- Boundary locking
- Layer editing
- Stroke candidate detection
- Editable SVG stroke export
- Texture cluster simplification
- Difference overlay
- Node-count visualization

## 27.4 P2 — Advanced Reconstruction

- Arc fitting
- Gradient reconstruction
- Pattern reconstruction
- Advanced AI segmentation
- Amodal object reconstruction
- Partial occlusion recovery
- Custom palette workflows
- Project persistence
- Collaboration
- Batch processing
- Plugin system

---

# 28. Development Phases

## Phase 1 — Region Model Proof of Concept

Implement:

- Upload
- Palette reduction
- Label map
- Connected regions
- Independent region IDs
- Region recoloring
- Simple SVG output

Success criterion:

Two disconnected same-color areas remain independently editable in the exported SVG.

## Phase 2 — Shared Boundaries and Geometry

Implement:

- Adjacency graph
- Shared boundaries
- Curve segmentation
- Line fitting
- Cubic Bézier fitting
- Error measurement
- Topology validation

Success criterion:

Adjacent planar regions have no gaps and use the same shared boundary geometry.

## Phase 3 — Editor

Implement:

- PixiJS region preview
- Selection
- Region inspector
- Recolor
- Delete
- Split
- Merge
- Undo and redo
- Layer basics

Success criterion:

A user can correct reconstruction errors without external software.

## Phase 4 — AI Analysis and Selection

Implement:

- Image analysis AI
- Style recommendation
- Region proposals
- Click-assisted selection
- Proposal acceptance workflow

Success criterion:

AI reduces manual region selection without directly creating final SVG paths.

## Phase 5 — Stroke and Texture

Implement:

- Stroke detection
- Centerline extraction
- Width estimation
- Texture clusters
- Detail budget
- Landscape test set

Success criterion:

Line art and landscape textures produce manageable editable SVG documents.

## Phase 6 — Export and Compatibility

Implement:

- Editable SVG
- Optimized SVG
- Flattened SVG
- Project JSON
- Metadata
- Compatibility testing

---

# 29. Testing Strategy

## 29.1 Unit Tests

Test:

- Color conversion
- Palette assignment
- Label map generation
- Connected components
- Stable region identity
- Region split
- Region merge
- Palette merge without geometry merge
- Adjacency graph
- Shared boundary extraction
- Curve fitting
- Error measurement
- Closed-path validation
- Self-intersection detection
- Hole hierarchy
- SVG metadata generation
- Undo and redo

## 29.2 Integration Test Images

Include:

- Two same-color disconnected circles
- Two touching same-color objects with a semantic split
- Flat logo
- Anime illustration
- Simple landscape illustration
- Complex landscape
- Line drawing
- Posterized portrait
- Transparent PNG
- Gradient sky
- Dense foliage
- Water reflections
- Building geometry
- AI-generated illustration
- Compression-damaged JPEG

## 29.3 Visual Regression Tests

Track:

- Region count
- Shape count
- Node count
- Maximum fitting error
- Layer order
- SVG rendered difference
- Same-color region independence

## 29.4 Compatibility Tests

Test exported SVG with:

- Chrome
- Firefox
- Edge
- Inkscape
- Illustrator
- Affinity Designer
- Figma
- Blender

## 29.5 AI Evaluation

Measure:

- Proposal acceptance rate
- Region-mask overlap
- Selection correction time
- Semantic naming usefulness
- Layer-order accuracy
- Natural-language command success
- User override frequency

AI evaluation must be separate from SVG geometry quality evaluation.

---

# 30. Performance Targets

Initial targets:

| Operation | 2048 × 2048 target |
|---|---:|
| Decode and analyze | Under 3 seconds |
| Palette reduction | Under 5 seconds |
| Initial region generation | Under 8 seconds |
| Boundary reconstruction | Under 10 seconds |
| SVG generation | Under 5 seconds |
| Region recolor | Under 100 ms |
| Region selection | Under 50 ms |
| Local boundary refit | Under 500 ms |

AI calls are excluded from deterministic processing targets.

The UI must remain responsive during all heavy work.

---

# 31. Acceptance Criteria

The MVP is accepted when:

1. Regiona loads supported raster images.
2. Heavy processing runs outside the main UI thread.
3. The application generates a persistent region model.
4. Same-color disconnected regions remain independent.
5. Palette merging does not merge geometry.
6. Recoloring a region does not change topology.
7. Users can select and recolor individual regions.
8. Users can explicitly merge selected regions.
9. Users can split at least simple regions.
10. Adjacent planar regions can share one boundary.
11. SVG paths are closed where required.
12. Exported paths have no self-intersections.
13. Basic line and Bézier reconstruction works.
14. Editable SVG includes stable region IDs.
15. Editable SVG preserves region-level editability.
16. SVG opens correctly in browsers and Inkscape.
17. Undo and redo work for structural edits.
18. AI outputs are represented as proposals.
19. AI does not directly control final SVG path geometry.
20. The application supports flat artwork and at least one landscape test case.
21. Repeated processing does not cause obvious memory growth.
22. The user can export project JSON and reload the project.
23. The output is materially easier to edit than a conventional auto-traced SVG.

---

# 32. Non-Goals for MVP

The MVP will not:

- Generate 3MF or STL
- Perform CAD extrusion
- Optimize for nozzle sizes
- Model 3D printing behavior
- Promise lossless photo reconstruction
- Recreate every texture mark
- Fully recover hidden objects
- Replace Illustrator
- Provide pixel-level photo retouching
- Allow AI to directly generate final path coordinates
- Automatically merge all same-color geometry
- Guarantee perfect semantic understanding
- Support fully automatic complex scene reconstruction

---

# 33. Product Risks

## 33.1 Region Explosion

Complex landscapes may create too many regions.

Mitigation:

- Detail budgets
- Texture clusters
- Shape-count limits
- Progressive simplification
- AI-assisted grouping suggestions

## 33.2 Semantic Ambiguity

The same-color connected area may contain multiple logical objects.

Mitigation:

- Manual split
- Click-assisted AI segmentation
- User-drawn separation line
- Protected region hints

## 33.3 AI Inconsistency

AI proposals may vary.

Mitigation:

- Proposal-only architecture
- User confirmation
- Persist accepted masks
- Deterministic geometry after acceptance
- Confidence display

## 33.4 Geometry Quality

Poor curve fitting may create visible distortion.

Mitigation:

- Error-bound fitting
- Local refit
- Corner protection
- Visual difference overlay
- Node budget controls

## 33.5 SVG Complexity

Highly detailed output may remain difficult to edit.

Mitigation:

- Detail presets
- Shape budget
- Node budget
- Texture simplification
- Optimized export mode

---

# 34. Future Opportunities

Potential future directions:

- AI-assisted hidden-object completion
- Editable text recovery
- Font matching
- Illustration style presets
- Scene-aware layer decomposition
- Object-level recoloring
- Automatic palette harmonization
- Batch asset conversion
- SVG animation preparation
- Plugin SDK
- Adobe Illustrator plugin
- Figma plugin
- Local desktop application
- Team project collaboration
- Design-system asset extraction

---

# 35. Engineering Principles

1. Reconstruct visual regions, not raw pixel contours.
2. Region identity is independent from color.
3. Same-color regions remain independent by default.
4. Palette merge must never imply geometry union.
5. Shared boundaries are reconstructed once.
6. AI proposes structure; deterministic engines generate geometry.
7. Every AI proposal must be inspectable and reversible.
8. Default output prioritizes editability.
9. SVG paths must be valid and reproducible.
10. Curve fitting must use measurable error.
11. Important corners must be preserved.
12. Texture must respect a defined detail budget.
13. Semantic labels are optional.
14. The system must support both flat art and landscapes.
15. Complex photographs are style-reconstructed, not losslessly traced.
16. User corrections are part of the intended workflow.
17. Every structural edit must support undo.
18. Local-only operation must remain possible.
19. Cloud AI must be opt-in.
20. The Regiona project model is the source of truth.
21. Cleaned raster previews are not the source of truth.
22. Editable SVG is the default export.
23. Flattening and geometry optimization are explicit export choices.
24. Correct structure is more important than one-click output.
25. The product should reduce manual redraw work, not merely export an SVG file.

---

# 36. Recommended Initial Implementation Prompt

Build the first Regiona prototype using:

```text
React
TypeScript
Vite
PixiJS
OpenCV.js
Web Worker
OffscreenCanvas
ImageBitmap
```

Implement in this order:

1. Initialize the React and TypeScript application.
2. Load OpenCV.js in a Web Worker.
3. Upload and decode a raster image.
4. Analyze image size, color complexity, edges, gradients, and texture.
5. Quantize the image to a configurable palette.
6. Generate a palette-index label map.
7. Build connected visual regions.
8. Assign a stable ID to every region.
9. Ensure disconnected same-color regions remain independent.
10. Allow selecting and recoloring one region.
11. Build the region adjacency graph.
12. Extract shared raster boundaries between adjacent regions.
13. Fit line and cubic Bézier segments with a measurable error limit.
14. Build closed vector shapes.
15. Validate self-intersections and invalid contours.
16. Generate an editable SVG with one independent element per region.
17. Include stable region metadata in the SVG.
18. Display original, region-map, boundary, and vector previews in PixiJS.
19. Add merge, delete, basic split, undo, and redo.
20. Export Regiona project JSON and editable SVG.
21. Validate the prototype using flat artwork and a simple landscape.
22. Do not implement 3MF, STL, or 3D-print-specific validation.
23. Do not automatically union same-color geometry.
24. Keep the architecture ready for AI proposals, but do not make AI a dependency of the geometric core.

The first prototype should prioritize:

- Region identity
- Editability
- Shared boundaries
- Curve quality
- Geometry validity
- Reproducibility

It should not prioritize advanced styling, cloud infrastructure, or fully automatic reconstruction.

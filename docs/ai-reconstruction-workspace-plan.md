# Implementation Plan: node-based image workflow

## Objective

Evolve Regiona into a visible, restartable image workflow. Users begin with one uploaded image, branch into AI and analysis tasks, inspect each task in context, and choose the result that should enter the deterministic Regiona vector editor.

This plan restores the design document's **Analyze** and **Colorize** concepts, alongside the newly requested **Clean redraw** and **Black line art** tasks. It also adds an initial mode-selection screen so users can choose a fast, direct Regiona path or the full visual workflow.

## Product model

```text
                         ┌──────────────────┐
                         │   Analyze image  │──► reverse prompt
                         └──────────────────┘
                                  ▲
                                  │
┌────────────┐          ┌──────────┴───────┐       ┌───────────────────┐
│ Start      │─────────►│ AI clean redraw  │──────►│ Apply source      │
│ Upload     │     ┌───►│                  │       │ colours           │
└────────────┘     │    └──────────────────┘       └───────────────────┘
       │           │             │                         │
       │           │             └───────────────┐         │
       │           │                             ▼         ▼
       │           └────►┌──────────────────────────────────────┐
       └────────────────►│ Regiona vector: quantify, edit, export│
                          └──────────────────────────────────────┘
       │
       └───────────────►┌──────────────────┐
                         │ Black line art   │───────────────► Regiona vector
                         └──────────────────┘
```

### Node catalogue

| Node | Inputs | Output | User purpose |
| --- | --- | --- | --- |
| **Start** | User file | Original image | Establishes the immutable reference image for the workflow. |
| **AI clean redraw** | Original image | Cleaned image | Removes non-semantic texture and noisy fragments while preserving composition. |
| **Analyze** | Original or any generated image | Reverse prompt | Reconstructs a prompt-ready visual description from visible evidence; it does not assess Regiona processing. |
| **Black line art** | Original image | Black lines on white | Produces an independently reviewable line-art candidate. |
| **Apply source colours** | Clean redraw + original + current palette when available | Colour reconstruction | Restores semantic source colours onto clean geometry. |
| **Regiona vector** | Any selected image candidate | Editable Regiona result | Runs the existing local quantization, regions, vector preview, editing, and export pipeline. |

## Workflow interaction design

### Initial mode selection

Before an image has been uploaded, Regiona shows a focused entry screen with two equally clear choices:

| Choice | First action | Best for |
| --- | --- | --- |
| **Start with Regiona** | Upload image, then immediately enter the existing quantized/regions/vector editor. | Users who already have a usable source image and want fast local editing. |
| **Build a workflow** | Open the workflow graph, upload into its Start node, then choose AI and analysis branches. | Users who want to clean, inspect, redraw, line-art, or compare images before vectorization. |

The entry screen is not a blocking one-time decision. Direct Regiona exposes **Open workflow** once an image is present; it creates the workflow with the current image as Start. Workflow exposes **Open Regiona editor** when a current vector source is available. Neither transition silently changes image data.

### Canvas and nodes

- The main application surface becomes a React Flow canvas with the default workflow pre-populated after upload.
- A node is a concise status card: title, input summary, last-run status, result thumbnail or report summary, and stale/error state. It does not contain a full image editor.
- Clicking a node opens a dedicated inspector workspace. Image-producing nodes show the original and selected output side-by-side using the existing linked Pixi pan/zoom view. Analyze shows a structured, copyable reverse prompt.
- Start can fan out to any compatible task. Version one exposes prebuilt, typed nodes and valid handles; it does not allow arbitrary script-like nodes or invalid connections.
- `Regiona vector` accepts a compatible image output selected through its incoming edge. It must never run against an ambiguous or stale upstream result.
- Black line art has a direct, first-class compatible edge to `Regiona vector`; users can select that edge and run only the line-art-to-vector path without first producing a clean redraw or colour reconstruction.

### Running and rerunning

Workflow-level controls:

- **Run ready nodes**: runs every enabled node whose current inputs are available, in dependency order.
- **Run to Regiona vector**: runs the selected valid upstream path and then starts local Regiona processing.
- **Cancel current run**: stops queued local work and prevents subsequent queued nodes from starting. A non-abortable Gemini response may finish, but is ignored if its run revision is no longer current.

Node-level controls:

- **Run / Regenerate**: runs only the selected node using its current inputs and settings.
- **Open details**: opens comparison, analysis findings, errors, or configuration.
- **Use in Regiona vector**: connects/chooses a specific image candidate as the input to the vector node, then requires confirmation before resetting the editable Regiona document.

### Revision and invalidation rule

Every node output has a monotonically increasing revision. Rerunning Start, Clean redraw, Black line art, or Apply source colours marks every descendant result **stale** but retains it for comparison. A stale result cannot be used by Regiona vector or included in `Run ready nodes` until it has been rerun with current inputs.

If a user confirms a candidate as the Regiona vector source, the existing regions, selections, vector edits, palette edits, and undo/redo history reset because their geometry belongs to a different image. The original Start image and all workflow candidates remain visible in the graph. This applies equally to Clean redraw, Apply source colours, and Black line art candidates.

## Architecture decisions

- Add `@xyflow/react` (React Flow) for the graph UI. Current official documentation supports controlled node/edge state, custom nodes, handles, controls, and a visible-elements rendering option; its current release is 12.11.2. [React Flow component reference](https://reactflow.dev/api-reference/react-flow), [custom nodes guide](https://reactflow.dev/learn/customization/custom-nodes), and [interactivity guide](https://reactflow.dev/learn/concepts/adding-interactivity).
- Keep execution state in a pure Regiona workflow model, not in React Flow node objects. React Flow gets a derived projection of node status, positions, and edges. This makes stale-result handling testable and avoids coupling orchestration to rendering.
- Expand the existing `src/ai/workflow-state.ts` rather than replacing it. It already models original and intermediate images; add typed nodes, revisions, dependencies, output states, and analysis results.
- Extend `ImageReconstructionProvider` with `createLineArt`. Keep `createCleanRedraw` and `reconstructColors` as separate operations so their prompts and inputs remain explicit.
- Implement Analyze as structured, text-only reverse-prompt analysis using the existing `AiStructureAnalysis` parser. It does not generate SVG geometry, alter the source, or silently change Regiona settings.
- Use React Flow custom node components defined outside render, as recommended by its documentation, and use `onlyRenderVisibleElements` after profiling demonstrates it is helpful. The graph itself is small; image rendering remains in the existing Pixi viewer.
- Store graph layout and outputs only in browser memory in version one. No key, generated image, or workflow is committed to Git or sent to a Regiona backend.

## Phased task plan

### Phase 1 — Workflow domain model (risk-first)

- [ ] Extend the existing AI workflow state with typed node IDs, input/output contracts, revisions, stale/ready/running/error status, and valid dependency checks.
- [ ] Define a deterministic graph template containing Start, Analyze, Clean redraw, Black line art, Apply source colours, and Regiona vector.
- [ ] Add pure unit tests for fan-out, invalid connections, rerun invalidation, and candidate adoption eligibility.

**Acceptance criteria**

- A Start image can validly feed Analyze, Clean redraw, Black line art, and Regiona vector.
- Clean redraw plus Start can validly feed Apply source colours.
- Rerunning an upstream image-producing node marks only its descendants stale.

**Verification**

- `npm.cmd test -- --run tests/ai-workflow-state.test.ts`
- `npm.cmd run typecheck`

### Phase 2 — Gemini task contracts

- [ ] Add the line-art operation and a bounded black-on-white prompt.
- [ ] Add Analyze provider integration that validates structured results with the existing parser.
- [ ] Add provider tests for input ordering, errors, JPEG/PNG outputs, and malformed analysis data.

**Acceptance criteria**

- Each provider task has explicit required inputs and cannot receive an unsupported file.
- Analyze returns a displayable, copyable reverse prompt rather than modifying processing settings.
- Live API calls remain out of automated tests.

**Verification**

- Focused provider and analysis tests.
- `npm.cmd run lint`, `npm.cmd run typecheck`.

### Checkpoint A — Contract review

- [ ] Review node names, default edges, black-line-art style, Analyze report fields, and stale-result copy with the user.
- [ ] Confirm whether `Run to Regiona vector` should execute one chosen source path or all compatible branches (recommended: one chosen path).

### Phase 3 — React Flow shell

- [ ] Add the direct-Regiona / Build-a-workflow entry screen and safe mode transitions.
- [ ] Add `@xyflow/react` and its required stylesheet using the official documented setup.
- [ ] Create controlled graph state, custom Regiona workflow nodes, typed handles, a compact node toolbar, and visible status states.
- [ ] Add graph-level Run ready / Run to Regiona vector / Cancel controls.

**Acceptance criteria**

- A first-time user can choose either mode before upload, and can move from direct Regiona into a workflow without re-uploading.
- Nodes are keyboard-selectable and draggable; only valid typed connections are accepted.
- Clicking a node opens its inspector without unintentionally running it.
- Graph panning/zooming does not conflict with the embedded image inspector.

**Verification**

- Component tests for status and control state.
- Manual checks at 1024px and 1440px.
- `npm.cmd run build`.

### Phase 4 — Inspector workspaces and image comparison

- [ ] Implement image-node inspectors with Original/Output linked Pixi comparison, progress, error, download, and regenerate actions.
- [ ] Implement Analyze inspector with the structured reverse-prompt sections and a single full-prompt copy action.
- [ ] Implement a confirmation dialog for selecting an image result as the Regiona vector source.

**Acceptance criteria**

- Users can inspect any candidate before using it.
- Cancelling source adoption changes nothing in the existing Regiona editor.
- Confirming source adoption resets image-dependent Regiona state once, then runs normal processing.

**Verification**

- State/component tests for confirmation and cancellation.
- Full test suite, lint, typecheck, and build.

### Phase 5 — Execution orchestration and polish

- [ ] Execute ready nodes in topological order; prevent stale/ambiguous dependencies from running.
- [ ] Wire node-level regeneration and stale state into the inspectors and graph.
- [ ] Make Black line art → Regiona vector an explicit selectable path and verify it does not require other AI branches.
- [ ] Update README and in-app help with BYOK, request cost/latency caveats, data handling, and the restart model.

**Acceptance criteria**

- Users can branch from Start, inspect results, rerun a previous task, and see only affected downstream nodes become stale.
- A user can run Black line art directly into Regiona vector from the graph.
- Overall Run controls never auto-apply an AI image to the editable Regiona document.
- The existing deterministic vector editing flow continues to work once a source is selected.

**Verification**

- Full unit suite, lint, typecheck, production build.
- Manual BYOK smoke test with a user-provided key only.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A visual graph implies arbitrary automation that is unsafe or confusing | High | Typed input/output handles, fixed node catalogue, explicit confirmations, and a small default template. |
| Reruns accidentally overwrite a good candidate | High | Immutable output revisions; old results stay visible but stale until explicitly discarded. |
| Gemini latency/quota makes “Run ready” feel stuck | High | Per-node progress, queue status, no duplicate requests, clear 429 messages, and cancellation of queued work. |
| Existing Pixi and React Flow pan/zoom compete | Medium | Keep graph interaction in the main canvas; the inspector is a separate surface with focus and pointer boundaries. |
| Too much work appears in one node | Medium | Nodes are summaries; detailed controls open in inspectors. |
| Analysis is mistaken for authoritative vector output | Medium | Analyze is text-only reverse prompting; deterministic Regiona processing owns final vector geometry. |

## Explicitly out of scope for version one

- Free-form user-created code nodes, arbitrary graph scripting, cloud workflow persistence, collaboration, or a server-side queue.
- Automatic adoption of an AI image into Regiona vector editing.
- Transparent line-art output, multiple line-art styles, batch images, and AI-authored final SVG paths.
- Migration of existing region edits from one source image revision to another.

## Decisions needed before implementation

1. Confirm the default graph: Start → Analyze/Clean redraw/Black line art/Regiona vector, and Clean redraw + Start → Apply source colours.
2. Confirm the initial screen defaults neither option, and labels the choices **Start with Regiona** / **Build a workflow**.
3. Confirm `Run to Regiona vector` uses one explicitly selected image path, rather than automatically executing every branch.
4. Confirm line art begins as pure black strokes on white background.
5. Confirm graph layout and results are session-only for version one.

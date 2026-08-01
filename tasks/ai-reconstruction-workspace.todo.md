# Node-based image workflow tasks

- [x] Task 1: Expand pure workflow state into typed nodes, edges, output revisions, and invalidation rules.
  - Acceptance: Fan-out, current inputs, stale descendants, and source-adoption eligibility are deterministic and tested.
  - Verify: `npm.cmd test -- --run tests/ai-workflow-state.test.ts`; `npm.cmd run typecheck`.
  - Dependencies: None.
  - Files: `src/ai/workflow-state.ts`, `tests/ai-workflow-state.test.ts`.

- [ ] Task 2: Add Gemini Line art and Analyze task contracts.
  - Acceptance: Line art uses original only; Analyze returns validated proposal data; no live API call in tests.
  - Verify: focused provider/analysis tests; `npm.cmd run lint`; `npm.cmd run typecheck`.
  - Dependencies: Task 1.
  - Files: `src/ai/openai-image-provider.ts`, `src/ai/gemini-image-provider.ts`, `src/ai/structure-analysis.ts`, tests.

- [ ] Checkpoint A: User approves graph template, path-selection rule, and line-art default.

- [ ] Task 3: Add direct-Regiona / Build-a-workflow entry screen and controlled React Flow canvas.
  - Acceptance: Users can select either entry route, move from direct Regiona into a graph without re-uploading, and use fixed typed nodes/edges accessibly.
  - Verify: component tests; manual responsive check; `npm.cmd run build`.
  - Dependencies: Tasks 1–2.
  - Files: `package.json`, new workflow components, `src/app/App.tsx`, styles, tests.

- [ ] Task 4: Add node inspectors for generated image comparison and Analyze reports.
  - Acceptance: Original/Output comparison uses linked Pixi views; reports are readable; errors/loading are local to the task.
  - Verify: component tests; `npm.cmd test`; `npm.cmd run lint`; `npm.cmd run typecheck`.
  - Dependencies: Task 3.
  - Files: new inspector components, existing canvas components, `src/app/App.tsx`, styles, tests.

- [ ] Task 5: Integrate task queue, node rerun, stale status, and confirmed Regiona source adoption.
  - Acceptance: Run ready follows dependencies; Black line art can directly feed Regiona vector; reruns invalidate only descendants; choosing a new source resets the editable document only after confirmation.
  - Verify: full test suite, lint, typecheck, production build, manual BYOK smoke test.
  - Dependencies: Tasks 3–4.
  - Files: `src/app/App.tsx`, workflow state, inspector/graph components, tests, README.

- [ ] Checkpoint B: User acceptance review before any commit or push.

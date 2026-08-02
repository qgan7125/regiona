# Spec: Reverse prompt analysis and line-art colorization

## Objective

Make **Analyze** useful before reconstruction by producing a prompt-ready, text-only reverse prompt from the source image. Replace the weak `Apply source colors` branch with **Colorize line art**, which uses the original image as the color reference and the generated black line art as the geometry reference. This keeps AI clean redraw as an independent alternative branch.

## User flows

- `Start -> Analyze`: return the six reverse-prompt sections; never generate or alter an image.
- `Start -> Black line art -> Colorize line art -> Regiona vector`: preserve the line-art composition, keep black line work, and restore source-appropriate colors to its white regions.
- `Start -> AI clean redraw -> Regiona vector`: remains unchanged and independent.

## Contracts

`AiStructureAnalysis` includes the reverse-prompt result in addition to concise Regiona advice:

1. `recreationPrompt` — 130–220 words.
2. `corePrompt` — 30–60 words.
3. `negativePrompt` — one prompt line.
4. `styleTags` — exactly four tags.
5. `analysis` — 3–5 sentences.
6. `variantOffer` — one final sentence.

The Gemini provider requests JSON for these fields and validates untrusted responses before the UI renders them. `ColorReconstructionInput` is renamed to make `lineArt` explicit; it sends the line-art image first and the original image second.

## Commands

- Type check: `npm.cmd run typecheck`
- Tests: `npm.cmd test`
- Lint: `npm.cmd run lint`
- Production build: `npm.cmd run build`

## Project structure

- `src/ai/` — provider contracts, Gemini requests, and validation.
- `src/components/` — workflow graph and inspector UI.
- `src/app/App.tsx` — workflow state, handlers, and status.
- `tests/` — provider and parsing contracts.

## Code style

Use explicit domain names and render structured text through typed fields rather than raw AI HTML:

```ts
await provider.colorizeLineArt({ original, lineArt, palette });
```

## Testing strategy

Add or update unit tests for parser fields, Gemini request ordering, and workflow colorization readiness. Run the complete Vitest suite, type check, lint, build, then make an explicit local-only commit.

## Boundaries

- Always: keep Gemini keys local, validate provider JSON, preserve source pixels until the user explicitly adopts a candidate.
- Ask first: add dependencies, change deployment, or push to GitHub.
- Never: call an AI provider during tests, expose key material, or silently replace the source image.

## Success criteria

- The graph and inspector call the node **Colorize line art** and show that it needs black line art, not clean redraw.
- A colorize request contains black line art plus original source and says it must retain black linework.
- Analyze renders all six requested reverse-prompt sections and continues to show concise Regiona reconstruction advice.
- Tests, lint, type check, and build pass.

import type { PaletteColor, ReconstructionResult } from "../types/project";

const MAX_COLOR_HISTORY_ENTRIES = 50;

export function getPaletteFillChoices(palette: PaletteColor[]) {
  return [...new Set(palette.map((color) => color.hex.toLowerCase()))];
}

export function appendColorHistory(
  history: ReconstructionResult[],
  previous: ReconstructionResult,
  next: ReconstructionResult,
) {
  if (previous === next) return history;

  return [...history.slice(-(MAX_COLOR_HISTORY_ENTRIES - 1)), previous];
}

export function undoColorEdit(
  result: ReconstructionResult,
  history: ReconstructionResult[],
) {
  const previous = history.at(-1);
  if (!previous) return { result, history };

  return {
    result: previous,
    history: history.slice(0, -1),
  };
}

export function redoColorEdit(
  result: ReconstructionResult,
  future: ReconstructionResult[],
) {
  const next = future[0];
  if (!next) return { result, future };

  return {
    result: next,
    future: future.slice(1),
  };
}

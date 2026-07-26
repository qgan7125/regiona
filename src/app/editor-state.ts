import type { PaletteColor, VisualRegion } from "../types/project";

const MAX_COLOR_HISTORY_ENTRIES = 50;

export function getPaletteFillChoices(palette: PaletteColor[]) {
  return [...new Set(palette.map((color) => color.hex.toLowerCase()))];
}

export function appendColorHistory(
  history: VisualRegion[][],
  previousRegions: VisualRegion[],
  nextRegions: VisualRegion[],
) {
  if (
    previousRegions.length === nextRegions.length &&
    previousRegions.every((region, index) => region.fill === nextRegions[index]?.fill)
  ) {
    return history;
  }

  return [...history.slice(-(MAX_COLOR_HISTORY_ENTRIES - 1)), previousRegions];
}

export function undoColorEdit(
  regions: VisualRegion[],
  history: VisualRegion[][],
) {
  const previousRegions = history.at(-1);
  if (!previousRegions) return { regions, history };

  return {
    regions: previousRegions,
    history: history.slice(0, -1),
  };
}

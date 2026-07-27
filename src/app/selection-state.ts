const MAX_SELECTION_HISTORY_ENTRIES = 50;

function isSameSelection(left: string[], right: string[]) {
  return left.length === right.length && left.every((regionId) => right.includes(regionId));
}

export function appendSelectionHistory(
  history: string[][],
  previousSelection: string[],
  nextSelection: string[],
) {
  if (isSameSelection(previousSelection, nextSelection)) return history;

  return [...history.slice(-(MAX_SELECTION_HISTORY_ENTRIES - 1)), previousSelection];
}

export function undoSelectionEdit(selection: string[], history: string[][]) {
  const previousSelection = history.at(-1);
  if (!previousSelection) return { selection, history };

  return {
    selection: previousSelection,
    history: history.slice(0, -1),
  };
}

export function redoSelectionEdit(selection: string[], future: string[][]) {
  const nextSelection = future[0];
  if (!nextSelection) return { selection, future };

  return {
    selection: nextSelection,
    future: future.slice(1),
  };
}

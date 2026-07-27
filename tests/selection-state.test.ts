import { describe, expect, it } from "vitest";

import {
  appendSelectionHistory,
  redoSelectionEdit,
  undoSelectionEdit,
} from "../src/app/selection-state";

describe("selection state history", () => {
  it("restores the prior selected regions when undoing a selection edit", () => {
    const before = ["region-00001"];
    const after = ["region-00001", "region-00002"];
    const history = appendSelectionHistory([], before, after);

    expect(undoSelectionEdit(after, history)).toEqual({
      selection: before,
      history: [],
    });
  });

  it("restores an undone selection when redoing it", () => {
    const before = ["region-00001"];
    const after = ["region-00001", "region-00002"];
    const undone = undoSelectionEdit(after, appendSelectionHistory([], before, after));

    expect(redoSelectionEdit(undone.selection, [after])).toEqual({
      selection: after,
      future: [],
    });
  });

  it("does not create a history entry when the same selected set is reordered", () => {
    expect(
      appendSelectionHistory([], ["region-00001", "region-00002"], ["region-00002", "region-00001"]),
    ).toEqual([]);
  });
});

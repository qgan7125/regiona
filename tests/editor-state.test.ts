import { describe, expect, it } from "vitest";

import {
  appendColorHistory,
  getPaletteFillChoices,
  redoColorEdit,
  undoColorEdit,
} from "../src/app/editor-state";
import type { PaletteColor, VisualRegion } from "../src/types/project";

const region = (id: string, fill: string): VisualRegion => ({
  id,
  colorId: "color-000",
  fill,
  opacity: 1,
  pixelArea: 1,
  bounds: { x: 0, y: 0, width: 1, height: 1 },
  origin: "deterministic",
  pathData: [],
});

const palette = (hex: string): PaletteColor => ({
  id: `color-${hex}`,
  index: 0,
  hex,
  rgba: [0, 0, 0, 255],
  pixelCount: 1,
  percentage: 1,
});

describe("editor color state", () => {
  it("offers each known palette color once", () => {
    expect(
      getPaletteFillChoices([palette("#FF5A36"), palette("#ff5a36"), palette("#112233")]),
    ).toEqual(["#ff5a36", "#112233"]);
  });

  it("restores the prior region fills when undoing a color edit", () => {
    const before = [region("region-00001", "#112233"), region("region-00002", "#112233")];
    const after = [region("region-00001", "#ff5a36"), region("region-00002", "#112233")];
    const history = appendColorHistory([], before, after);

    expect(undoColorEdit(after, history)).toEqual({
      regions: before,
      history: [],
    });
  });

  it("restores an undone color edit when redoing it", () => {
    const before = [region("region-00001", "#112233")];
    const after = [region("region-00001", "#ff5a36")];
    const undone = undoColorEdit(after, appendColorHistory([], before, after));

    expect(redoColorEdit(undone.regions, [after])).toEqual({
      regions: after,
      future: [],
    });
  });

  it("does not create a history entry when a selected fill is unchanged", () => {
    const regions = [region("region-00001", "#112233")];

    expect(appendColorHistory([], regions, regions)).toEqual([]);
  });
});

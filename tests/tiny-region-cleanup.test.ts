import { describe, expect, it } from "vitest";

import { removeTinyPaletteRegions } from "../src/engine/regions/remove-tiny-regions";

describe("removeTinyPaletteRegions", () => {
  it("merges an isolated color speck into its surrounding region", () => {
    const cleaned = removeTinyPaletteRegions(
      new Uint8Array([
        0, 0, 0,
        0, 1, 0,
        0, 0, 0,
      ]),
      3,
      3,
      1,
    );

    expect([...cleaned]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps every region unchanged when cleanup is disabled", () => {
    const paletteIndexes = new Uint8Array([0, 1, 0]);

    expect(removeTinyPaletteRegions(paletteIndexes, 3, 1, 0)).toEqual(paletteIndexes);
  });
});

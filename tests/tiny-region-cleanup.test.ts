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

  it("merges a low-contrast speck when the source image has no strong edge", () => {
    const paletteIndexes = new Uint8Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    const sourcePixels = new Uint8ClampedArray([
      8, 8, 8, 255, 8, 8, 8, 255, 8, 8, 8, 255,
      8, 8, 8, 255, 24, 24, 24, 255, 8, 8, 8, 255,
      8, 8, 8, 255, 8, 8, 8, 255, 8, 8, 8, 255,
    ]);

    const cleaned = removeTinyPaletteRegions(
      paletteIndexes,
      3,
      3,
      1,
      sourcePixels,
    );

    expect([...cleaned]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps a high-contrast tiny detail separated by an original-image edge", () => {
    const paletteIndexes = new Uint8Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    const sourcePixels = new Uint8ClampedArray([
      8, 8, 8, 255, 8, 8, 8, 255, 8, 8, 8, 255,
      8, 8, 8, 255, 248, 248, 248, 255, 8, 8, 8, 255,
      8, 8, 8, 255, 8, 8, 8, 255, 8, 8, 8, 255,
    ]);

    const cleaned = removeTinyPaletteRegions(
      paletteIndexes,
      3,
      3,
      1,
      sourcePixels,
    );

    expect(cleaned[4]).toBe(1);
  });
});

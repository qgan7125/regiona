import { describe, expect, it } from "vitest";

import { despecklePaletteIndexes } from "../src/engine/regions/despeckle";

describe("despecklePaletteIndexes", () => {
  it("replaces an isolated speck with its surrounding majority value", () => {
    const cleaned = despecklePaletteIndexes(
      new Uint8Array([
        0, 0, 0,
        0, 1, 0,
        0, 0, 0,
      ]),
      3,
      3,
    );

    expect([...cleaned]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("leaves a pixel unchanged when its neighbors are evenly split", () => {
    const paletteIndexes = new Uint8Array([
      0, 1, 0, 1, 0,
      1, 0, 1, 0, 1,
      0, 1, 0, 1, 0,
      1, 0, 1, 0, 1,
      0, 1, 0, 1, 0,
    ]);

    // The center pixel has 4 neighbors of each value, an exact tie.
    expect(despecklePaletteIndexes(paletteIndexes, 5, 5)[12]).toBe(0);
  });

  it("preserves a high-contrast tiny detail marked by a strong source edge", () => {
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

    const cleaned = despecklePaletteIndexes(paletteIndexes, 3, 3, sourcePixels);

    expect(cleaned[4]).toBe(1);
  });

  it("despeckles a low-contrast speck when the source image has no strong edge", () => {
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

    const cleaned = despecklePaletteIndexes(paletteIndexes, 3, 3, sourcePixels);

    expect(cleaned[4]).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  selectedPixelOutline,
  selectedPixelMask,
  shouldUseSelectionTexture,
} from "../src/preview/selection-rendering";

describe("shouldUseSelectionTexture", () => {
  it("uses an exact pixel mask when small paths collectively exceed the SVG render budget", () => {
    const regions = Array.from({ length: 20 }, () => ({
      path: `M 0 0 ${"H 1 ".repeat(600)}Z`,
      bounds: { x: 0, y: 0, width: 2000, height: 1 },
    }));

    expect(shouldUseSelectionTexture(regions)).toBe(true);
  });

  it("keeps a small selection rendered as its original region geometry", () => {
    expect(
      shouldUseSelectionTexture([
        { path: "M 0 0 H 10 V 10 H 0 Z", bounds: { x: 0, y: 0, width: 10, height: 10 } },
      ]),
    ).toBe(false);
  });

  it("retains only selected region pixels for the texture fallback", () => {
    const pixels = new Uint8ClampedArray([
      10, 11, 12, 255,
      20, 21, 22, 255,
      30, 31, 32, 255,
    ]);
    const labelMap = new Uint32Array([1, 2, 1]);

    expect([...selectedPixelMask(pixels, labelMap, new Set([2]))]).toEqual([
      0, 0, 0, 0,
      20, 21, 22, 255,
      0, 0, 0, 0,
    ]);
  });

  it("traces the exact outer edge of selected regions for the texture fallback", () => {
    const labelMap = new Uint32Array([
      1, 1, 1,
      1, 2, 1,
      1, 1, 1,
    ]);

    expect([...selectedPixelOutline(labelMap, 3, 3, new Set([2]))]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 242, 92, 53, 255, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

});

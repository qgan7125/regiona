import { describe, expect, it } from "vitest";

import {
  SELECTION_TILE_SIZE,
  selectedPixelMaskForTile,
  selectedPixelOutlineForTile,
  selectedPixelOutline,
  selectedPixelMask,
  selectionTilesForRegionNumbers,
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

  it("marks only the tiles touched by changed region bounds", () => {
    const regionBounds = new Uint32Array([
      0, 0, 0, 0,
      250, 250, 20, 20,
      520, 4, 8, 8,
    ]);

    expect(
      selectionTilesForRegionNumbers([1, 2], regionBounds, 600, 600),
    ).toEqual([
      { x: 0, y: 0, width: SELECTION_TILE_SIZE, height: SELECTION_TILE_SIZE },
      { x: 256, y: 0, width: SELECTION_TILE_SIZE, height: SELECTION_TILE_SIZE },
      { x: 512, y: 0, width: 88, height: SELECTION_TILE_SIZE },
      { x: 0, y: 256, width: SELECTION_TILE_SIZE, height: SELECTION_TILE_SIZE },
      { x: 256, y: 256, width: SELECTION_TILE_SIZE, height: SELECTION_TILE_SIZE },
    ]);
  });

  it("renders a tile from the full image without losing its global outline edge", () => {
    const pixels = new Uint8ClampedArray([
      1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255,
      4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255,
      7, 0, 0, 255, 8, 0, 0, 255, 9, 0, 0, 255,
    ]);
    const labelMap = new Uint32Array([
      1, 1, 1,
      1, 2, 1,
      1, 1, 1,
    ]);
    const tile = { x: 1, y: 1, width: 1, height: 1 };

    expect([...selectedPixelMaskForTile(pixels, labelMap, 3, tile, new Set([2]))]).toEqual([
      5, 0, 0, 255,
    ]);
    expect([...selectedPixelOutlineForTile(labelMap, 3, 3, tile, new Set([2]))]).toEqual([
      242, 92, 53, 255,
    ]);
  });

});

import { describe, expect, it } from "vitest";

import { quantizeImage } from "../src/engine/color/quantize";

describe("quantizeImage", () => {
  it("reduces an image to no more than the requested number of colors", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      250, 5, 5, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);

    const result = quantizeImage(pixels, 2);

    expect(result.palette.length).toBeLessThanOrEqual(2);
    expect(result.paletteIndexes).toHaveLength(4);
  });

  it("is deterministic for identical input and settings", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255,
      30, 40, 50, 255,
      200, 210, 220, 255,
      220, 230, 240, 255,
    ]);

    const first = quantizeImage(pixels, 2);
    const second = quantizeImage(pixels, 2);

    expect(second.palette).toEqual(first.palette);
    expect(second.paletteIndexes).toEqual(first.paletteIndexes);
  });

  it("keeps substantial colors when a few noisy pixels expand the source gamut", () => {
    const pixels = new Uint8ClampedArray([
      ...Array.from({ length: 30 }, () => [25, 45, 105, 255]).flat(),
      ...Array.from({ length: 15 }, () => [215, 65, 45, 255]).flat(),
      0, 255, 0, 255,
      255, 255, 0, 255,
      0, 255, 255, 255,
      255, 0, 255, 255,
      255, 255, 255, 255,
    ]);

    const result = quantizeImage(pixels, 3);

    expect(result.palette.every((color) => color.pixelCount > 0)).toBe(true);
    expect(
      result.palette.some(
        (color) => color.rgba[2] > color.rgba[0] && color.rgba[2] > color.rgba[1],
      ),
    ).toBe(true);
    expect(
      result.palette.some(
        (color) => color.rgba[0] > color.rgba[1] && color.rgba[0] > color.rgba[2],
      ),
    ).toBe(true);
  });

  it("reserves palette entries for distinct colors instead of spending them on a dominant gradient", () => {
    const blueGradient = Array.from({ length: 12 }, (_, index) => (
      Array.from({ length: 40 }, () => [20, 50 + index * 8, 120 + index * 8, 255]).flat()
    )).flat();
    const pixels = new Uint8ClampedArray([
      ...blueGradient,
      ...Array.from({ length: 20 }, () => [220, 45, 40, 255]).flat(),
      ...Array.from({ length: 20 }, () => [35, 190, 70, 255]).flat(),
      ...Array.from({ length: 20 }, () => [245, 215, 40, 255]).flat(),
      ...Array.from({ length: 20 }, () => [25, 25, 30, 255]).flat(),
    ]);

    const result = quantizeImage(pixels, 5);

    expect(result.palette.some((color) => color.rgba[0] > color.rgba[1] * 1.5)).toBe(true);
    expect(result.palette.some((color) => color.rgba[1] > color.rgba[0] * 1.5)).toBe(true);
    expect(result.palette.some((color) => color.rgba[0] > 180 && color.rgba[1] > 160 && color.rgba[2] < 100)).toBe(true);
    expect(result.palette.some((color) => Math.max(...color.rgba.slice(0, 3)) < 70)).toBe(true);
    expect(result.palette.some((color) => color.rgba[2] > color.rgba[0] * 2)).toBe(true);
  });

  it("clusters colors by perceptual distance, not raw RGB distance", () => {
    // White is much closer to green than to blue perceptually (OKLab), even though raw
    // RGB distance treats the two as exactly equidistant from white. Quantizing to 2
    // colors should therefore group white with green and keep blue as the separate color.
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const green: [number, number, number, number] = [0, 255, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const pixels = new Uint8ClampedArray([
      ...Array.from({ length: 40 }, () => white).flat(),
      ...Array.from({ length: 20 }, () => green).flat(),
      ...Array.from({ length: 20 }, () => blue).flat(),
    ]);

    const result = quantizeImage(pixels, 2);

    const whiteCluster = result.paletteIndexes[0];
    const greenCluster = result.paletteIndexes[40];
    const blueCluster = result.paletteIndexes[60];

    expect(greenCluster).toBe(whiteCluster);
    expect(blueCluster).not.toBe(whiteCluster);
  });
});

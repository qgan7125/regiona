import { describe, expect, it } from "vitest";

import {
  reconstructImage,
  recolorRegion,
  recolorRegions,
  renderRegionPixels,
} from "../src/engine/reconstruct";

describe("reconstructImage", () => {
  it("builds independently editable paths for disconnected same-color pixels", () => {
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const rgba = new Uint8ClampedArray(
      [
        black, white, black,
        white, white, white,
        black, white, black,
      ].flat(),
    );

    const result = reconstructImage({
      pixels: rgba,
      width: 3,
      height: 3,
      targetColors: 2,
      sourceFilename: "disconnected.png",
    });
    const darkColor = result.palette.find((color) => color.hex === "#000000");
    const darkRegions = result.regions.filter(
      (region) => region.colorId === darkColor?.id,
    );

    expect(darkRegions).toHaveLength(4);
    expect(darkRegions.every((region) => region.pathData.length > 0)).toBe(true);
  });

  it("carries source alpha into the reconstructed region model", () => {
    const result = reconstructImage({
      pixels: new Uint8ClampedArray([20, 40, 60, 0]),
      width: 1,
      height: 1,
      targetColors: 2,
      sourceFilename: "transparent.png",
    });

    expect(result.regions[0]?.opacity).toBe(0);
    expect(result.quantizedPixels[3]).toBe(0);
  });

  it("despeckles low-contrast quantization noise even when Simplify Regions is off", () => {
    const dark: [number, number, number, number] = [10, 10, 10, 255];
    const nearDark: [number, number, number, number] = [14, 14, 14, 255];
    const result = reconstructImage({
      pixels: new Uint8ClampedArray(
        [dark, dark, dark, dark, nearDark, dark, dark, dark, dark].flat(),
      ),
      width: 3,
      height: 3,
      targetColors: 3,
      sourceFilename: "noise.png",
    });

    expect(result.regions).toHaveLength(1);
  });

  it("leaves quantization noise alone when despeckle is explicitly disabled", () => {
    const dark: [number, number, number, number] = [10, 10, 10, 255];
    // Contrasty enough to survive the bilateral pre-filter and quantize into its
    // own palette entry, but still below removeTinyPaletteRegions' edge threshold.
    const speck: [number, number, number, number] = [30, 30, 30, 255];
    const pixels = new Uint8ClampedArray(
      [dark, dark, dark, dark, speck, dark, dark, dark, dark].flat(),
    );

    const withDespeckle = reconstructImage({
      pixels,
      width: 3,
      height: 3,
      targetColors: 3,
      despeckleEnabled: true,
      sourceFilename: "noise.png",
    });
    const withoutDespeckle = reconstructImage({
      pixels,
      width: 3,
      height: 3,
      targetColors: 3,
      despeckleEnabled: false,
      sourceFilename: "noise.png",
    });

    expect(withDespeckle.regions).toHaveLength(1);
    expect(withoutDespeckle.regions).toHaveLength(2);
  });

  it("keeps isolated high-contrast details when tiny-region cleanup is enabled", () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const result = reconstructImage({
      pixels: new Uint8ClampedArray([
        red, red, red,
        red, blue, red,
        red, red, red,
      ].flat()),
      width: 3,
      height: 3,
      targetColors: 2,
      tinyRegionMaximumArea: 1,
      sourceFilename: "speck.png",
    });

    expect(result.regions).toHaveLength(2);
    expect([...result.quantizedPixels.slice(16, 20)]).not.toEqual(
      [...result.quantizedPixels.slice(0, 4)],
    );
  });
});

describe("region appearance editing", () => {
  it("recolors one region without changing another region that shares its color", () => {
    const regions = [
      {
        id: "region-00001",
        colorId: "color-000",
        fill: "#111111",
        opacity: 1,
        pixelArea: 1,
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        origin: "deterministic" as const,
        pathData: ["M 0 0 H 1 V 1 H 0 Z"],
      },
      {
        id: "region-00002",
        colorId: "color-000",
        fill: "#111111",
        opacity: 1,
        pixelArea: 1,
        bounds: { x: 1, y: 0, width: 1, height: 1 },
        origin: "deterministic" as const,
        pathData: ["M 1 0 H 2 V 1 H 1 Z"],
      },
    ];

    const recolored = recolorRegion(regions, "region-00001", "#ff5a36");

    expect(recolored[0]?.fill).toBe("#ff5a36");
    expect(recolored[1]?.fill).toBe("#111111");
    expect(regions[0]?.fill).toBe("#111111");
  });

  it("recolors every selected region in one batch", () => {
    const regions = [
      { id: "a", colorId: "c", fill: "#111111", opacity: 1, pixelArea: 1, bounds: { x: 0, y: 0, width: 1, height: 1 }, origin: "deterministic" as const, pathData: [] },
      { id: "b", colorId: "c", fill: "#222222", opacity: 1, pixelArea: 1, bounds: { x: 1, y: 0, width: 1, height: 1 }, origin: "deterministic" as const, pathData: [] },
      { id: "c", colorId: "c", fill: "#333333", opacity: 1, pixelArea: 1, bounds: { x: 2, y: 0, width: 1, height: 1 }, origin: "deterministic" as const, pathData: [] },
    ];

    expect(recolorRegions(regions, ["a", "c"], "#ff5a36").map((region) => region.fill))
      .toEqual(["#ff5a36", "#222222", "#ff5a36"]);
  });

  it("renders edited region colors from the label map", () => {
    const pixels = renderRegionPixels(
      new Uint32Array([1, 2]),
      [
        {
          id: "region-00001",
          colorId: "color-000",
          fill: "#ff0000",
          opacity: 1,
          pixelArea: 1,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          origin: "deterministic",
          pathData: [],
        },
        {
          id: "region-00002",
          colorId: "color-000",
          fill: "#0000ff",
          opacity: 1,
          pixelArea: 1,
          bounds: { x: 1, y: 0, width: 1, height: 1 },
          origin: "deterministic",
          pathData: [],
        },
      ],
    );

    expect([...pixels]).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });

  it("preserves region opacity in rendered pixels", () => {
    const pixels = renderRegionPixels(new Uint32Array([1]), [
      {
        id: "region-00001",
        colorId: "color-000",
        fill: "#112233",
        opacity: 0.5,
        pixelArea: 1,
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        origin: "deterministic",
        pathData: [],
      },
    ]);

    expect([...pixels]).toEqual([17, 34, 51, 128]);
  });
});

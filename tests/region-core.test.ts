import { describe, expect, it } from "vitest";

import { buildRegions } from "../src/engine/regions/build-regions";
import { traceRegionPaths } from "../src/engine/regions/trace-regions";
import { exportEditableSvg } from "../src/engine/svg/export-svg";

describe("buildRegions", () => {
  it("keeps disconnected areas with the same color independently editable", () => {
    const paletteIndexes = new Uint8Array([
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ]);

    const result = buildRegions(paletteIndexes, 3, 3, [
      { id: "color-000", hex: "#101010" },
      { id: "color-001", hex: "#f5f5f5" },
    ]);

    const darkRegions = result.regions.filter(
      (region) => region.colorId === "color-000",
    );

    expect(darkRegions).toHaveLength(4);
    expect(new Set(darkRegions.map((region) => region.id)).size).toBe(4);
    expect(darkRegions.map((region) => region.id)).toEqual([
      "region-00001",
      "region-00003",
      "region-00004",
      "region-00005",
    ]);
  });

  it("uses stable scan-order IDs and records region bounds", () => {
    const result = buildRegions(
      new Uint8Array([
        0, 0,
        1, 1,
      ]),
      2,
      2,
      [
        { id: "color-000", hex: "#000000" },
        { id: "color-001", hex: "#ffffff" },
      ],
    );

    expect(result.regions).toMatchObject([
      {
        id: "region-00001",
        colorId: "color-000",
        pixelArea: 2,
        bounds: { x: 0, y: 0, width: 2, height: 1 },
      },
      {
        id: "region-00002",
        colorId: "color-001",
        pixelArea: 2,
        bounds: { x: 0, y: 1, width: 2, height: 1 },
      },
    ]);
  });
});

describe("traceRegionPaths", () => {
  it("creates one closed path for a rectangular region", () => {
    const traced = traceRegionPaths(
      new Uint32Array([
        1, 1,
        1, 1,
      ]),
      2,
      2,
      1,
    );

    expect(traced).toEqual(["M 0 0 H 2 V 2 H 0 Z"]);
  });

  it("preserves holes with an even-odd compatible subpath", () => {
    const traced = traceRegionPaths(
      new Uint32Array([
        1, 1, 1,
        1, 0, 1,
        1, 1, 1,
      ]),
      3,
      3,
      1,
    );

    expect(traced).toHaveLength(2);
    expect(traced.every((path) => path.endsWith("Z"))).toBe(true);
  });
});

describe("exportEditableSvg", () => {
  it("exports stable metadata and separate elements for same-color regions", () => {
    const svg = exportEditableSvg({
      width: 3,
      height: 1,
      sourceFilename: "two-dots.png",
      regions: [
        {
          id: "region-00001",
          colorId: "color-000",
          fill: "#202020",
          opacity: 1,
          pixelArea: 1,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          origin: "deterministic",
          pathData: ["M 0 0 H 1 V 1 H 0 Z"],
        },
        {
          id: "region-00002",
          colorId: "color-000",
          fill: "#202020",
          opacity: 1,
          pixelArea: 1,
          bounds: { x: 2, y: 0, width: 1, height: 1 },
          origin: "deterministic",
          pathData: ["M 2 0 H 3 V 1 H 2 Z"],
        },
      ],
    });

    expect(svg).toContain('data-regiona-version="0.1.0"');
    expect(svg).toContain('id="region-00001"');
    expect(svg).toContain('id="region-00002"');
    expect(svg.match(/fill="#202020"/g)).toHaveLength(2);
  });

  it("writes SVG fill opacity for translucent regions", () => {
    const svg = exportEditableSvg({
      width: 1,
      height: 1,
      sourceFilename: "transparent.png",
      regions: [
        {
          id: "region-00001",
          colorId: "color-000",
          fill: "#336699",
          opacity: 0.25,
          pixelArea: 1,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          origin: "deterministic",
          pathData: ["M 0 0 H 1 V 1 H 0 Z"],
        },
      ],
    });

    expect(svg).toContain('fill-opacity="0.2500"');
  });
});

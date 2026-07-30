import { describe, expect, it } from "vitest";

import { buildRegions } from "../src/engine/regions/build-regions";
import { traceAllRegionPaths, traceRegionPaths } from "../src/engine/regions/trace-regions";
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

  it("simplifies a diagonal split between two regions without leaving a gap", () => {
    // A 12x12 grid split diagonally into exactly two regions - no third region anywhere,
    // so the shared boundary's only anchors are the two points where it meets the image
    // border (here (0,1) and (11,12), not the exact image corners).
    const size = 12;
    const labelMap = new Uint32Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        labelMap[y * size + x] = x < y ? 1 : 2;
      }
    }

    const allPaths = traceAllRegionPaths(labelMap, size, size, 2);
    const extractNumbers = (path: string) =>
      (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const extractVertices = (path: string) => {
      const tokens = path.match(/[A-Z][^A-Z]*/g) ?? [];
      let x = 0;
      let y = 0;
      const points: Array<{ x: number; y: number }> = [];
      for (const token of tokens) {
        const numbers = token.slice(1).trim().split(/\s+/).filter(Boolean).map(Number);
        if (token[0] === "M" || token[0] === "L") {
          x = numbers[0] ?? x;
          y = numbers[1] ?? y;
        } else if (token[0] === "H") {
          x = numbers[0] ?? x;
        } else if (token[0] === "V") {
          y = numbers[0] ?? y;
        } else if (token[0] === "C") {
          x = numbers[4] ?? x;
          y = numbers[5] ?? y;
        } else continue;
        points.push({ x, y });
      }
      return points;
    };

    const [regionOnePath] = allPaths[0] ?? [];
    const [regionTwoPath] = allPaths[1] ?? [];
    const junctionA = { x: 0, y: 1 };
    const junctionB = { x: 11, y: 12 };
    const hasVertex = (path: string, point: { x: number; y: number }) =>
      extractVertices(path).some((vertex) => vertex.x === point.x && vertex.y === point.y);

    // Both regions independently detected and kept the exact same shared-boundary
    // endpoints - the invariant that prevents the two sides from drifting apart.
    expect(hasVertex(regionOnePath!, junctionA)).toBe(true);
    expect(hasVertex(regionOnePath!, junctionB)).toBe(true);
    expect(hasVertex(regionTwoPath!, junctionA)).toBe(true);
    expect(hasVertex(regionTwoPath!, junctionB)).toBe(true);

    // Regression guard for a non-uniform Catmull-Rom tangent bug where mismatched
    // segment lengths sent control points wildly outside the image bounds.
    const allNumbers = [regionOnePath!, regionTwoPath!].flatMap(extractNumbers);
    expect(allNumbers.every((value) => value >= -1 && value <= size + 1)).toBe(true);
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

import { describe, expect, it } from "vitest";

import { refineClosedPolygonSubpixel } from "../src/engine/geometry/subpixel-refine";

function buildHardVerticalEdge(width: number, height: number, boundaryX: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = x < boundaryX ? 20 : 220;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

describe("refineClosedPolygonSubpixel", () => {
  it("moves a traced boundary point toward the true sub-pixel edge location", () => {
    const width = 20;
    const height = 20;
    // The pixel boundary itself (not a coverage-blended fraction) is the ground truth here:
    // pixel 10 is fully dark, pixel 11 is fully light, so the true edge sits exactly at
    // x=11 - the only anti-aliasing in play is from bilinear resampling itself, avoiding
    // any dependence on a separately-modeled coverage function.
    const boundaryX = 11;
    const pixels = buildHardVerticalEdge(width, height, boundaryX);
    const polygon = [
      { x: 10, y: 8 }, { x: 10, y: 9 }, { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 },
      { x: 10, y: 8 },
    ];

    const refined = refineClosedPolygonSubpixel(polygon, pixels, width, height);
    const middlePoint = refined[2]!;

    expect(Math.abs(middlePoint.x - boundaryX)).toBeLessThan(Math.abs(polygon[2]!.x - boundaryX));
  });

  it("leaves anchor points exactly where they are", () => {
    const width = 20;
    const height = 20;
    const pixels = buildHardVerticalEdge(width, height, 11);
    const polygon = [
      { x: 10, y: 8 }, { x: 10, y: 9 }, { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 },
      { x: 10, y: 8 },
    ];
    const isAnchor = (point: { x: number; y: number }) => point.x === 10 && point.y === 10;

    const refined = refineClosedPolygonSubpixel(polygon, pixels, width, height, isAnchor);

    expect(refined[2]).toEqual({ x: 10, y: 10 });
  });

  it("does not spuriously shift points on flat, noisy regions with no real edge", () => {
    const width = 20;
    const height = 20;
    const pixels = new Uint8ClampedArray(width * height * 4);
    let state = 7;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let index = 0; index < pixels.length; index += 4) {
      const value = 128 + (random() - 0.5) * 12;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
    const polygon = [
      { x: 10, y: 8 }, { x: 10, y: 9 }, { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 },
      { x: 10, y: 8 },
    ];

    const refined = refineClosedPolygonSubpixel(polygon, pixels, width, height);

    for (const point of refined) {
      expect(Math.abs(point.x - 10)).toBeLessThan(0.05);
    }
  });

  it("produces the same refined position for a shared point regardless of trace direction", () => {
    const width = 30;
    const height = 30;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const value = x > y + 5 ? 220 : 20;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
    const point = { x: 15, y: 10 };
    const before = { x: 14, y: 9 };
    const after = { x: 16, y: 11 };

    const forward = refineClosedPolygonSubpixel(
      [before, point, after, before],
      pixels,
      width,
      height,
    );
    const backward = refineClosedPolygonSubpixel(
      [after, point, before, after],
      pixels,
      width,
      height,
    );

    expect(forward[1]).toEqual(backward[1]);
  });

  it("returns points unchanged when source pixels are missing or mismatched", () => {
    const polygon = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 0 }];

    expect(refineClosedPolygonSubpixel(polygon, undefined, 10, 10)).toEqual(polygon);
    expect(
      refineClosedPolygonSubpixel(polygon, new Uint8ClampedArray(4), 10, 10),
    ).toEqual(polygon);
  });
});

import { describe, expect, it } from "vitest";

import { reconstructImage } from "../src/engine/reconstruct";
import { buildVectorPreviewSvg } from "../src/engine/svg/vector-preview";

describe("buildVectorPreviewSvg", () => {
  it("uses the same shared cubic boundary geometry as SVG export", () => {
    const result = reconstructImage({
      pixels: new Uint8ClampedArray([
        0, 0, 0, 255,
        255, 255, 255, 255,
      ]),
      width: 2,
      height: 1,
      targetColors: 2,
      sourceFilename: "two-regions.png",
    });

    const svg = buildVectorPreviewSvg(result);

    expect(svg).toContain(" C ");
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
  });
});

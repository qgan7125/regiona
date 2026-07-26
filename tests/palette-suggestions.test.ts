import { describe, expect, it } from "vitest";

import { appendPickedColor, getPaletteSuggestions } from "../src/app/palette-suggestions";
import type { ColorSample } from "../src/preview/color-sample";
import type { PaletteColor } from "../src/types/project";

const sample = (hex: string, red: number, green: number, blue: number): ColorSample => ({
  alpha: 255,
  blue,
  green,
  hex,
  red,
  rgb: `rgb(${red}, ${green}, ${blue})`,
  x: 0,
  y: 0,
});

const palette = (hex: string, rgba: PaletteColor["rgba"], index: number): PaletteColor => ({
  hex,
  id: `palette-${index}`,
  index,
  percentage: 0.1,
  pixelCount: 10,
  rgba,
});

describe("getPaletteSuggestions", () => {
  it("lists the closest distinct palette colors for every picked color", () => {
    const result = getPaletteSuggestions(
      [sample("#5c443e", 92, 68, 62)],
      [
        palette("#907060", [144, 112, 96, 255], 0),
        palette("#604840", [96, 72, 64, 255], 1),
        palette("#57413d", [87, 65, 61, 255], 2),
        palette("#604840", [96, 72, 64, 255], 3),
      ],
      2,
    );

    expect(result).toEqual([
      {
        picked: sample("#5c443e", 92, 68, 62),
        colors: ["#57413d", "#604840"],
      },
    ]);
  });

  it("keeps the most recent distinct picked colors at the front of the list", () => {
    const first = sample("#5c443e", 92, 68, 62);
    const second = sample("#e8c56a", 232, 197, 106);

    expect(appendPickedColor([first], second)).toEqual([second, first]);
    expect(appendPickedColor([second, first], first)).toEqual([first, second]);
  });
});

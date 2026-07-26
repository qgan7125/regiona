import type { ColorSample } from "../preview/color-sample";
import type { PaletteColor } from "../types/project";

export interface PaletteSuggestionGroup {
  picked: ColorSample;
  colors: string[];
}

const MAX_PICKED_COLORS = 8;

export function appendPickedColor(
  pickedColors: ColorSample[],
  nextColor: ColorSample,
) {
  const nextHex = nextColor.hex.toLowerCase();
  return [
    nextColor,
    ...pickedColors.filter((color) => color.hex.toLowerCase() !== nextHex),
  ].slice(0, MAX_PICKED_COLORS);
}

function colorDistance(
  left: Pick<ColorSample, "red" | "green" | "blue">,
  right: PaletteColor,
) {
  const [red, green, blue] = right.rgba;
  return (left.red - red) ** 2 + (left.green - green) ** 2 + (left.blue - blue) ** 2;
}

export function getPaletteSuggestions(
  pickedColors: ColorSample[],
  palette: PaletteColor[],
  maximumPerColor = 3,
): PaletteSuggestionGroup[] {
  const distinctPalette = [...new Map(
    palette.map((color) => [color.hex.toLowerCase(), color] as const),
  ).values()];

  return pickedColors.map((picked) => ({
    picked,
    colors: [...distinctPalette]
      .sort((left, right) => colorDistance(picked, left) - colorDistance(picked, right) || left.index - right.index)
      .slice(0, maximumPerColor)
      .map((color) => color.hex.toLowerCase()),
  }));
}

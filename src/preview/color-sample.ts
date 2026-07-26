export interface ColorSample {
  alpha: number;
  blue: number;
  green: number;
  hex: string;
  red: number;
  rgb: string;
  x: number;
  y: number;
}

const hexChannel = (value: number) => value.toString(16).padStart(2, "0");

export function colorSampleAt(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): ColorSample | undefined {
  if (x < 0 || y < 0 || x >= width || y >= height) return undefined;

  const offset = (y * width + x) * 4;
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  const alpha = pixels[offset + 3];
  if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
    return undefined;
  }

  return {
    alpha,
    blue,
    green,
    hex: `#${hexChannel(red)}${hexChannel(green)}${hexChannel(blue)}`,
    red,
    rgb: `rgb(${red}, ${green}, ${blue})`,
    x,
    y,
  };
}

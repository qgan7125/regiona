import type {
  PaletteColor,
  RegionBuildResult,
  VisualRegion,
} from "../../types/project";

type PaletteReference = Pick<PaletteColor, "id" | "hex"> &
  Partial<Pick<PaletteColor, "rgba">>;

export function buildRegions(
  paletteIndexes: Uint8Array,
  width: number,
  height: number,
  palette: PaletteReference[],
): RegionBuildResult {
  if (width <= 0 || height <= 0 || paletteIndexes.length !== width * height) {
    throw new Error("Palette index dimensions are invalid.");
  }

  const labelMap = new Uint32Array(paletteIndexes.length);
  const stack = new Uint32Array(paletteIndexes.length);
  const regions: VisualRegion[] = [];

  for (let start = 0; start < paletteIndexes.length; start += 1) {
    if ((labelMap[start] ?? 0) !== 0) continue;

    const regionNumber = regions.length + 1;
    const paletteIndex = paletteIndexes[start] ?? 0;
    let stackLength = 0;
    let pixelArea = 0;
    let minimumX = width;
    let minimumY = height;
    let maximumX = 0;
    let maximumY = 0;

    stack[stackLength] = start;
    stackLength += 1;
    labelMap[start] = regionNumber;

    while (stackLength > 0) {
      stackLength -= 1;
      const index = stack[stackLength] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);

      pixelArea += 1;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);

      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          (labelMap[neighbor] ?? 0) === 0 &&
          (paletteIndexes[neighbor] ?? -1) === paletteIndex
        ) {
          labelMap[neighbor] = regionNumber;
          stack[stackLength] = neighbor;
          stackLength += 1;
        }
      }
    }

    const color = palette[paletteIndex];
    if (!color) throw new Error(`Missing palette color at index ${paletteIndex}.`);

    regions.push({
      id: `region-${regionNumber.toString().padStart(5, "0")}`,
      colorId: color.id,
      fill: color.hex,
      opacity: (color.rgba?.[3] ?? 255) / 255,
      pixelArea,
      bounds: {
        x: minimumX,
        y: minimumY,
        width: maximumX - minimumX + 1,
        height: maximumY - minimumY + 1,
      },
      origin: "deterministic",
      pathData: [],
    });
  }

  return { labelMap, regions };
}

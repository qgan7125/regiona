import type { EditableSvgInput } from "../../types/project";
import { resolveRegionPathData } from "./resolve-region-paths";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function exportEditableSvg(input: EditableSvgInput) {
  const metadata = escapeXml(
    JSON.stringify({
      application: "Regiona",
      version: "0.1.0",
      sourceFilename: input.sourceFilename,
      regionCount: input.regions.length,
      generatedAt: new Date(0).toISOString(),
    }),
  );
  const paths = input.regions
    .map((region) => ({ region, pathData: resolveRegionPathData(input, region) }))
    .filter(({ pathData }) => pathData.length > 0)
    .map(({ region, pathData }) => {
      const opacity =
        region.opacity < 1 ? ` fill-opacity="${region.opacity.toFixed(4)}"` : "";
      return `  <path id="${escapeXml(region.id)}" data-region-id="${escapeXml(region.id)}" data-color-id="${escapeXml(region.colorId)}" fill="${escapeXml(region.fill)}"${opacity} fill-rule="evenodd" d="${escapeXml(pathData.join(" "))}" />`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" data-regiona-version="0.1.0">`,
    `  <metadata>${metadata}</metadata>`,
    '  <g id="regiona-regions">',
    paths,
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

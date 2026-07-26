import type { EditableSvgInput } from "../../types/project";

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
    .filter((region) => region.pathData.length > 0)
    .map(
      (region) =>
        `  <path id="${escapeXml(region.id)}" data-region-id="${escapeXml(region.id)}" data-color-id="${escapeXml(region.colorId)}" fill="${escapeXml(region.fill)}" fill-rule="evenodd" d="${escapeXml(region.pathData.join(" "))}" />`,
    )
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


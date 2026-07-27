import { exportEditableSvg } from "../engine/svg/export-svg";
import type { ReconstructionResult } from "../types/project";
import { downloadText } from "./download";

const safeBaseName = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "regiona-export";

export function exportRegionaSvg(result: ReconstructionResult) {
  downloadText(
    exportEditableSvg(result),
    `${safeBaseName(result.sourceFilename)}.regiona.svg`,
    "image/svg+xml;charset=utf-8",
  );
}

export function exportRegionaProject(result: ReconstructionResult) {
  downloadText(
    JSON.stringify(
      {
        application: "Regiona",
        version: "0.1.0",
        source: {
          filename: result.sourceFilename,
          width: result.width,
          height: result.height,
        },
        palette: result.palette,
        regions: result.regions,
      },
      null,
      2,
    ),
    `${safeBaseName(result.sourceFilename)}.regiona.json`,
    "application/json;charset=utf-8",
  );
}

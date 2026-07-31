export type AiImageKind = "logo" | "illustration" | "other";
export type AiRegionImportance = "primary" | "supporting" | "detail";

export interface AiStructureRegion {
  id: string;
  label: string;
  importance: AiRegionImportance;
  /** [top, left, bottom, right], normalized to the 0–1000 image coordinate space. */
  bounds: [number, number, number, number];
  suggestedFill?: string;
}

export interface AiStructureAnalysis {
  imageKind: AiImageKind;
  summary: string;
  regions: AiStructureRegion[];
}

export class AiStructureAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiStructureAnalysisError";
  }
}

const imageKinds = new Set<AiImageKind>(["logo", "illustration", "other"]);
const importanceLevels = new Set<AiRegionImportance>([
  "primary",
  "supporting",
  "detail",
]);
const regionIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const maximumRegions = 64;

export function parseAiStructureAnalysis(value: unknown): AiStructureAnalysis {
  const record = readRecord(value, "analysis");
  const imageKind = readString(record.imageKind, "imageKind", 24) as AiImageKind;
  const summary = readString(record.summary, "summary", 280);

  if (!imageKinds.has(imageKind)) {
    throw new AiStructureAnalysisError("imageKind must be logo, illustration, or other.");
  }
  if (!Array.isArray(record.regions) || record.regions.length > maximumRegions) {
    throw new AiStructureAnalysisError(`regions must contain at most ${maximumRegions} entries.`);
  }

  const regionIds = new Set<string>();
  const regions = record.regions.map((region, index) => {
    const parsed = parseRegion(region, index);
    if (regionIds.has(parsed.id)) {
      throw new AiStructureAnalysisError(`regions[${index}].id must be unique.`);
    }
    regionIds.add(parsed.id);
    return parsed;
  });

  return { imageKind, summary, regions };
}

function parseRegion(value: unknown, index: number): AiStructureRegion {
  const record = readRecord(value, `regions[${index}]`);
  const id = readString(record.id, `regions[${index}].id`, 64);
  const label = readString(record.label, `regions[${index}].label`, 80);
  const importance = readString(
    record.importance,
    `regions[${index}].importance`,
    16,
  ) as AiRegionImportance;

  if (!regionIdPattern.test(id)) {
    throw new AiStructureAnalysisError(`regions[${index}].id has an invalid format.`);
  }
  if (!importanceLevels.has(importance)) {
    throw new AiStructureAnalysisError(`regions[${index}].importance is invalid.`);
  }

  const bounds = parseBounds(record.bounds, index);
  const suggestedFill = record.suggestedFill === undefined
    ? undefined
    : parseSuggestedFill(record.suggestedFill, index);

  return { id, label, importance, bounds, ...(suggestedFill ? { suggestedFill } : {}) };
}

function parseBounds(value: unknown, index: number): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => !isCoordinate(part))) {
    throw new AiStructureAnalysisError(`regions[${index}].bounds must contain four normalized coordinates.`);
  }

  const [top, left, bottom, right] = value as [number, number, number, number];
  if (top >= bottom || left >= right) {
    throw new AiStructureAnalysisError(`regions[${index}].bounds must have positive area.`);
  }

  return [top, left, bottom, right];
}

function parseSuggestedFill(value: unknown, index: number): string {
  const hex = readString(value, `regions[${index}].suggestedFill`, 7);
  if (!hexColorPattern.test(hex)) {
    throw new AiStructureAnalysisError(`regions[${index}].suggestedFill must be a #RRGGBB color.`);
  }
  return hex.toLowerCase();
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AiStructureAnalysisError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== "string") {
    throw new AiStructureAnalysisError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximumLength) {
    throw new AiStructureAnalysisError(`${field} must be between 1 and ${maximumLength} characters.`);
  }
  return trimmed;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 0
    && value <= 1000;
}

export type AiImageKind = "logo" | "illustration" | "other";
export type AiRegionImportance = "primary" | "supporting" | "detail";
export type AiObjectRole = "subject" | "background" | "attached-object" | "interior-detail";
export type AiReconstructionStrategy = "restore" | "redraw" | "simplify";

export interface AiStructureRegion {
  id: string;
  label: string;
  importance: AiRegionImportance;
  /** [top, left, bottom, right], normalized to the 0–1000 image coordinate space. */
  bounds: [number, number, number, number];
  suggestedFill?: string;
}

export interface AiStructureObject {
  id: string;
  label: string;
  role: AiObjectRole;
  /** [top, left, bottom, right], normalized to the 0–1000 image coordinate space. */
  bounds: [number, number, number, number];
  /** Confidence normalized to the 0–1000 range. */
  confidence: number;
}

export interface AiStructureAnalysis {
  imageKind: AiImageKind;
  summary: string;
  subjectDescription: string;
  recreationPrompt: string;
  corePrompt: string;
  negativePrompt: string;
  styleTags: [string, string, string, string];
  analysis: string[];
  variantOffer: string;
  majorObjects: AiStructureObject[];
  suggestedColorCount: number;
  detectedProblems: string[];
  reconstructionStrategy: AiReconstructionStrategy;
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
const objectRoles = new Set<AiObjectRole>([
  "subject",
  "background",
  "attached-object",
  "interior-detail",
]);
const reconstructionStrategies = new Set<AiReconstructionStrategy>([
  "restore",
  "redraw",
  "simplify",
]);
const regionIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
const problemIdPattern = /^[a-z][a-z0-9-]{0,63}$/;
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const maximumRegions = 64;
const maximumObjects = 32;
const maximumProblems = 16;
const minimumRecreationPromptWords = 130;
const maximumRecreationPromptWords = 220;
const minimumCorePromptWords = 30;
const maximumCorePromptWords = 60;

export function parseAiStructureAnalysis(value: unknown): AiStructureAnalysis {
  const record = readRecord(value, "analysis");
  const imageKind = readString(record.imageKind, "imageKind", 24) as AiImageKind;
  const summary = readString(record.summary, "summary", 280);
  const subjectDescription = readString(record.subjectDescription, "subjectDescription", 280);
  const recreationPrompt = readPrompt(record.recreationPrompt, "recreationPrompt", {
    minimumWords: minimumRecreationPromptWords,
    maximumWords: maximumRecreationPromptWords,
    maximumLength: 2200,
  });
  const corePrompt = readPrompt(record.corePrompt, "corePrompt", {
    minimumWords: minimumCorePromptWords,
    maximumWords: maximumCorePromptWords,
    maximumLength: 800,
  });
  const negativePrompt = readSingleLine(record.negativePrompt, "negativePrompt", 500);
  const styleTags = parseStyleTags(record.styleTags);
  const analysis = parseReversePromptAnalysis(record.analysis);
  const variantOffer = readString(record.variantOffer, "variantOffer", 300);
  const majorObjects = parseMajorObjects(record.majorObjects);
  const suggestedColorCount = readInteger(record.suggestedColorCount, "suggestedColorCount", 2, 32);
  const detectedProblems = parseDetectedProblems(record.detectedProblems);
  const reconstructionStrategy = readString(
    record.reconstructionStrategy,
    "reconstructionStrategy",
    16,
  ) as AiReconstructionStrategy;

  if (!imageKinds.has(imageKind)) {
    throw new AiStructureAnalysisError("imageKind must be logo, illustration, or other.");
  }
  if (!reconstructionStrategies.has(reconstructionStrategy)) {
    throw new AiStructureAnalysisError("reconstructionStrategy must be restore, redraw, or simplify.");
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

  return {
    imageKind,
    summary,
    subjectDescription,
    recreationPrompt,
    corePrompt,
    negativePrompt,
    styleTags,
    analysis,
    variantOffer,
    majorObjects,
    suggestedColorCount,
    detectedProblems,
    reconstructionStrategy,
    regions,
  };
}

function parseStyleTags(value: unknown): [string, string, string, string] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new AiStructureAnalysisError("styleTags must contain exactly four tags.");
  }
  const tags = value.map((tag, index) => readSingleLine(tag, `styleTags[${index}]`, 64));
  if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length) {
    throw new AiStructureAnalysisError("styleTags must not contain duplicates.");
  }
  return tags as [string, string, string, string];
}

function parseReversePromptAnalysis(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) {
    throw new AiStructureAnalysisError("analysis must contain three to five sentences.");
  }
  return value.map((sentence, index) => readSingleLine(sentence, `analysis[${index}]`, 500));
}

function parseMajorObjects(value: unknown): AiStructureObject[] {
  if (!Array.isArray(value) || value.length > maximumObjects) {
    throw new AiStructureAnalysisError(`majorObjects must contain at most ${maximumObjects} entries.`);
  }

  const objectIds = new Set<string>();
  return value.map((object, index) => {
    const field = `majorObjects[${index}]`;
    const record = readRecord(object, field);
    const id = readString(record.id, `${field}.id`, 64);
    const label = readString(record.label, `${field}.label`, 80);
    const role = readString(record.role, `${field}.role`, 24) as AiObjectRole;
    const confidence = readInteger(record.confidence, `${field}.confidence`, 0, 1000);

    if (!regionIdPattern.test(id) || objectIds.has(id)) {
      throw new AiStructureAnalysisError(`${field}.id must be unique and use a safe format.`);
    }
    if (!objectRoles.has(role)) {
      throw new AiStructureAnalysisError(`${field}.role is invalid.`);
    }
    objectIds.add(id);

    return { id, label, role, bounds: parseBounds(record.bounds, field), confidence };
  });
}

function parseDetectedProblems(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > maximumProblems) {
    throw new AiStructureAnalysisError(`detectedProblems must contain at most ${maximumProblems} entries.`);
  }
  const problems = value.map((problem, index) =>
    readString(problem, `detectedProblems[${index}]`, 64),
  );
  if (problems.some((problem) => !problemIdPattern.test(problem))) {
    throw new AiStructureAnalysisError("detectedProblems must use safe identifiers.");
  }
  if (new Set(problems).size !== problems.length) {
    throw new AiStructureAnalysisError("detectedProblems must not contain duplicates.");
  }
  return problems;
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

  const bounds = parseBounds(record.bounds, `regions[${index}]`);
  const suggestedFill = record.suggestedFill === undefined
    ? undefined
    : parseSuggestedFill(record.suggestedFill, index);

  return { id, label, importance, bounds, ...(suggestedFill ? { suggestedFill } : {}) };
}

function parseBounds(value: unknown, field: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => !isCoordinate(part))) {
    throw new AiStructureAnalysisError(`${field}.bounds must contain four normalized coordinates.`);
  }

  const [top, left, bottom, right] = value as [number, number, number, number];
  if (top >= bottom || left >= right) {
    throw new AiStructureAnalysisError(`${field}.bounds must have positive area.`);
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

function readSingleLine(value: unknown, field: string, maximumLength: number): string {
  const text = readString(value, field, maximumLength);
  if (/\r|\n/.test(text)) {
    throw new AiStructureAnalysisError(`${field} must be one line.`);
  }
  return text;
}

function readPrompt(
  value: unknown,
  field: string,
  {
    minimumWords,
    maximumWords,
    maximumLength,
  }: { minimumWords: number; maximumWords: number; maximumLength: number },
): string {
  const prompt = readSingleLine(value, field, maximumLength);
  const words = prompt.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)?.length ?? 0;
  if (words < minimumWords || words > maximumWords) {
    throw new AiStructureAnalysisError(`${field} must contain ${minimumWords} to ${maximumWords} words.`);
  }
  return prompt;
}

function readInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new AiStructureAnalysisError(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 0
    && value <= 1000;
}

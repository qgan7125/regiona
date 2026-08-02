export interface AiStructureAnalysis {
  recreationPrompt: string;
  corePrompt: string;
  negativePrompt: string;
  styleTags: [string, string, string, string];
  analysis: string[];
  variantOffer: string;
}

export class AiStructureAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiStructureAnalysisError";
  }
}

const minimumRecreationPromptWords = 130;
const maximumRecreationPromptWords = 220;
const minimumCorePromptWords = 30;
const maximumCorePromptWords = 60;

export function parseAiStructureAnalysis(value: unknown): AiStructureAnalysis {
  const record = readRecord(value, "analysis");

  return {
    recreationPrompt: readPrompt(record.recreationPrompt, "recreationPrompt", {
      minimumWords: minimumRecreationPromptWords,
      maximumWords: maximumRecreationPromptWords,
      maximumLength: 2200,
    }),
    corePrompt: readPrompt(record.corePrompt, "corePrompt", {
      minimumWords: minimumCorePromptWords,
      maximumWords: maximumCorePromptWords,
      maximumLength: 800,
    }),
    negativePrompt: readSingleLine(record.negativePrompt, "negativePrompt", 500),
    styleTags: parseStyleTags(record.styleTags),
    analysis: parseReversePromptAnalysis(record.analysis),
    variantOffer: readString(record.variantOffer, "variantOffer", 300),
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

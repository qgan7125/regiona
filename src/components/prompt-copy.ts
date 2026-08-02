export type ClipboardWriter = (text: string) => Promise<void>;

export interface CompletePromptSections {
  recreationPrompt: string;
  corePrompt: string;
  negativePrompt: string;
  styleTags: readonly string[];
}

export function buildCompletePrompt({
  recreationPrompt,
  corePrompt,
  negativePrompt,
  styleTags,
}: CompletePromptSections): string {
  return [
    `Recreation Prompt:\n${recreationPrompt}`,
    `Core Prompt:\n${corePrompt}`,
    `Negative Prompt:\n${negativePrompt}`,
    `Style Tags:\n${styleTags.join(", ")}`,
  ].join("\n\n");
}

export async function copyPromptText(
  text: string,
  writeText?: ClipboardWriter,
): Promise<boolean> {
  if (!writeText) return false;

  try {
    await writeText(text);
    return true;
  } catch {
    return false;
  }
}

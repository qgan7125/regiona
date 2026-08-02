export type ClipboardWriter = (text: string) => Promise<void>;

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

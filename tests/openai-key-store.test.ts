import { describe, expect, it } from "vitest";

import {
  clearOpenAiApiKey,
  loadOpenAiApiKey,
  saveOpenAiApiKey,
  testOpenAiApiKey,
} from "../src/ai/openai-key-store";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("OpenAI BYOK storage", () => {
  it("uses session storage by default and clears any older remembered key", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();

    saveOpenAiApiKey("sk-user-key", false, { session, persistent });

    expect(loadOpenAiApiKey({ session, persistent })).toEqual({
      apiKey: "sk-user-key",
      rememberOnDevice: false,
    });
    expect(persistent.length).toBe(0);
  });

  it("persists only when the user explicitly opts in and clears both stores", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();

    saveOpenAiApiKey("sk-user-key", true, { session, persistent });
    expect(loadOpenAiApiKey({ session, persistent })).toEqual({
      apiKey: "sk-user-key",
      rememberOnDevice: true,
    });

    clearOpenAiApiKey({ session, persistent });
    expect(loadOpenAiApiKey({ session, persistent })).toEqual({
      apiKey: "",
      rememberOnDevice: false,
    });
  });

  it("tests a key without putting it in a failure message", async () => {
    await expect(testOpenAiApiKey("sk-secret-key", async () => new Response(null, {
      status: 401,
    }))).rejects.toThrow("OpenAI rejected this API key (401).");
  });
});

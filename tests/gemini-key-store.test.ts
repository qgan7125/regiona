import { describe, expect, it } from "vitest";

import {
  clearGeminiApiKey,
  loadGeminiApiKey,
  saveGeminiApiKey,
  testGeminiApiKey,
} from "../src/ai/gemini-key-store";

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

describe("Gemini BYOK storage", () => {
  it("uses session storage by default and clears any older remembered key", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();

    saveGeminiApiKey("gemini-user-key", false, { session, persistent });

    expect(loadGeminiApiKey({ session, persistent })).toEqual({
      apiKey: "gemini-user-key",
      rememberOnDevice: false,
    });
    expect(persistent.length).toBe(0);
  });

  it("persists only when explicitly requested and clears both stores", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();

    saveGeminiApiKey("gemini-user-key", true, { session, persistent });
    expect(loadGeminiApiKey({ session, persistent })).toEqual({
      apiKey: "gemini-user-key",
      rememberOnDevice: true,
    });

    clearGeminiApiKey({ session, persistent });
    expect(loadGeminiApiKey({ session, persistent })).toEqual({
      apiKey: "",
      rememberOnDevice: false,
    });
  });

  it("tests a key without including it in a failure message", async () => {
    await expect(testGeminiApiKey("gemini-secret-key", async () => new Response(null, {
      status: 403,
    }))).rejects.toThrow("Gemini rejected this API key (403).");
  });
});

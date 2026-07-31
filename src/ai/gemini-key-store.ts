const storageKey = "regiona.gemini-api-key";

export interface GeminiKeyStorage {
  session: Storage;
  persistent: Storage;
}

export interface StoredGeminiApiKey {
  apiKey: string;
  rememberOnDevice: boolean;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function loadGeminiApiKey(storage: GeminiKeyStorage = browserStorage()): StoredGeminiApiKey {
  const sessionKey = storage.session.getItem(storageKey);
  if (sessionKey) return { apiKey: sessionKey, rememberOnDevice: false };

  const persistentKey = storage.persistent.getItem(storageKey);
  return persistentKey
    ? { apiKey: persistentKey, rememberOnDevice: true }
    : { apiKey: "", rememberOnDevice: false };
}

export function saveGeminiApiKey(
  apiKey: string,
  rememberOnDevice: boolean,
  storage: GeminiKeyStorage = browserStorage(),
) {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("A Gemini API key is required.");

  const destination = rememberOnDevice ? storage.persistent : storage.session;
  const otherStore = rememberOnDevice ? storage.session : storage.persistent;
  destination.setItem(storageKey, normalizedKey);
  otherStore.removeItem(storageKey);
}

export function clearGeminiApiKey(storage: GeminiKeyStorage = browserStorage()) {
  storage.session.removeItem(storageKey);
  storage.persistent.removeItem(storageKey);
}

export async function testGeminiApiKey(
  apiKey: string,
  fetcher: FetchLike = fetch,
): Promise<void> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("Enter a Gemini API key before testing it.");

  let response: Response;
  try {
    response = await fetcher("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": normalizedKey },
    });
  } catch (cause) {
    throw new Error("Could not reach Gemini. Check your connection and try again.", { cause });
  }

  if (!response.ok) {
    throw new Error(`Gemini rejected this API key (${response.status}).`);
  }
}

function browserStorage(): GeminiKeyStorage {
  if (typeof window === "undefined") {
    throw new Error("Gemini key storage is available only in a browser.");
  }
  return {
    session: window.sessionStorage,
    persistent: window.localStorage,
  };
}

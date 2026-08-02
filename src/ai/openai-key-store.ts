const storageKey = "regiona.openai-api-key";

export interface OpenAiKeyStorage {
  session: Storage;
  persistent: Storage;
}

export interface StoredOpenAiApiKey {
  apiKey: string;
  rememberOnDevice: boolean;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function loadOpenAiApiKey(storage: OpenAiKeyStorage = browserStorage()): StoredOpenAiApiKey {
  const sessionKey = storage.session.getItem(storageKey);
  if (sessionKey) return { apiKey: sessionKey, rememberOnDevice: false };

  const persistentKey = storage.persistent.getItem(storageKey);
  return persistentKey
    ? { apiKey: persistentKey, rememberOnDevice: true }
    : { apiKey: "", rememberOnDevice: false };
}

export function saveOpenAiApiKey(
  apiKey: string,
  rememberOnDevice: boolean,
  storage: OpenAiKeyStorage = browserStorage(),
) {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("An OpenAI API key is required.");

  const destination = rememberOnDevice ? storage.persistent : storage.session;
  const otherStore = rememberOnDevice ? storage.session : storage.persistent;
  destination.setItem(storageKey, normalizedKey);
  otherStore.removeItem(storageKey);
}

export function clearOpenAiApiKey(storage: OpenAiKeyStorage = browserStorage()) {
  storage.session.removeItem(storageKey);
  storage.persistent.removeItem(storageKey);
}

export async function testOpenAiApiKey(
  apiKey: string,
  fetcher: FetchLike = fetch,
): Promise<void> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error("Enter an OpenAI API key before testing it.");

  let response: Response;
  try {
    response = await fetcher("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${normalizedKey}` },
    });
  } catch {
    throw new Error("Could not reach OpenAI. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(`OpenAI rejected this API key (${response.status}).`);
  }
}

function browserStorage(): OpenAiKeyStorage {
  if (typeof window === "undefined") {
    throw new Error("OpenAI key storage is available only in a browser.");
  }
  return {
    session: window.sessionStorage,
    persistent: window.localStorage,
  };
}

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Domän som den egna Google-nyckeln är godkänd för (webbplatsbegränsning). */
const OWN_KEY_REFERER = "https://mellberg.online/";

/**
 * Nycklar med webbplatsbegränsning nekar anrop som saknar referer.
 * Vi skickar därför alltid appens domän med från servern.
 */
export function createGoogleAiStudioFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Referer")) headers.set("Referer", OWN_KEY_REFERER);
    if (!headers.has("Origin")) headers.set("Origin", "https://mellberg.online");
    return fetch(input, { ...init, headers });
  };
}

/** Google-nyckeln för AI, i den ordning appen ska prova dem. */
export function googleAiKey(): string | undefined {
  return (
    process.env["GOOGLE_API_KEY"] ??
    process.env["GEMINI_API_KEY"] ??
    process.env["GOOGLE_MAPS_OWN_KEY"]
  );
}

export function createGoogleAiStudioProvider(geminiApiKey: string) {
  return createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: GOOGLE_OPENAI_BASE,
    apiKey: geminiApiKey,
    fetch: createGoogleAiStudioFetch(),
  });
}

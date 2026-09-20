import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/**
 * Serveranrop kan inte skicka en webbläsar-referer – runtime tar bort headern.
 * Nyckeln måste därför vara utan webbplatsbegränsning i Google Cloud.
 */
export function createGoogleAiStudioFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init);
}

/**
 * Google-nyckeln för AI. Kartnyckeln (GOOGLE_MAPS_OWN_KEY) används inte här –
 * den är inte giltig för Generative Language API och ger bara 400-fel.
 */
export function googleAiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
}

export function createGoogleAiStudioProvider(geminiApiKey: string) {
  return createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: GOOGLE_OPENAI_BASE,
    apiKey: geminiApiKey,
    fetch: createGoogleAiStudioFetch(),
  });
}

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

export function createGoogleAiStudioFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, init);
  };
}

export function createGoogleAiStudioProvider(geminiApiKey: string) {
  return createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: GOOGLE_OPENAI_BASE,
    apiKey: geminiApiKey,
    fetch: createGoogleAiStudioFetch(),
  });
}
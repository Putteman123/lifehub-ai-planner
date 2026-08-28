import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { ANDREA_FALLBACK_MODEL } from "@/lib/ai-models";

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const LOVABLE_OPENAI_BASE = "https://ai.gateway.lovable.dev/v1";

function withFallbackModel(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, model: ANDREA_FALLBACK_MODEL });
  } catch {
    return body;
  }
}

export function createGoogleAiStudioFetch(geminiApiKey: string, lovableApiKey?: string) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    if (!lovableApiKey || (response.status !== 429 && response.status < 500)) return response;

    const originalUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const fallbackUrl = originalUrl.replace(GOOGLE_OPENAI_BASE, LOVABLE_OPENAI_BASE);
    const headers = new Headers(init?.headers);
    headers.delete("authorization");
    headers.set("Lovable-API-Key", lovableApiKey);
    headers.set("X-Lovable-AIG-SDK", "vercel-ai-sdk");

    return fetch(fallbackUrl, {
      ...init,
      headers,
      body: withFallbackModel(init?.body),
    });
  };
}

export function createGoogleAiStudioProvider(geminiApiKey: string, lovableApiKey?: string) {
  return createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: GOOGLE_OPENAI_BASE,
    apiKey: geminiApiKey,
    fetch: createGoogleAiStudioFetch(geminiApiKey, lovableApiKey),
  });
}
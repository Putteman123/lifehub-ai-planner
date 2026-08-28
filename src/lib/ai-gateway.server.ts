import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let resolved = false;
  const ready = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });
  const publish = (value?: string) => {
    if (!runId && value?.trim()) runId = value.trim();
    if (!resolved) {
      resolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publish(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      try {
        const response = await fetch(input, { ...init, headers });
        publish(response.headers.get(RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publish();
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  };
}

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/** Fristående Responses-provider för Andreas oberoende Lovable AI-reserv. */
export function createLovableResponsesModel(apiKey: string, initialRunId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });
  return {
    model: provider.responses("openai/gpt-5.6-sol"),
    ...runIdFetch,
  };
}

/** Byter leverantör om primärmodellen avvisar anropet innan streamen startar. */
export function withModelFallback(primary: LanguageModel, fallback: LanguageModel): LanguageModel {
  if (primary.specificationVersion !== "v4" || fallback.specificationVersion !== "v4") {
    return primary;
  }
  return {
    specificationVersion: "v4",
    provider: `${primary.provider}+fallback`,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    doGenerate: async (options) => {
      try {
        return await primary.doGenerate(options);
      } catch (error) {
        console.warn("Andrea: primär AI misslyckades, använder Lovable AI-reserven.", error);
        return fallback.doGenerate(options);
      }
    },
    doStream: async (options) => {
      try {
        return await primary.doStream(options);
      } catch (error) {
        console.warn("Andrea: primär AI misslyckades, använder Lovable AI-reserven.", error);
        return fallback.doStream(options);
      }
    },
  };
}

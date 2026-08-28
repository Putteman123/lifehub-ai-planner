import { ANDREA_FAST_MODEL } from "@/lib/ai-models";
import { createGoogleAiStudioFetch } from "@/lib/google-ai.server";

type JsonSchema = { name: string; schema: Record<string, unknown> };

/**
 * Kör ett strömmande textanrop direkt mot användarens betalda Google AI Studio-konto.
 */
export async function completeText(opts: {
  apiKey?: string;
  system: string;
  input: string;
  jsonSchema?: JsonSchema;
  model?: string;
}): Promise<string> {
  const apiKey = opts.apiKey ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Google AI Studio API-nyckel saknas.");

  const googleFetch = createGoogleAiStudioFetch(apiKey, process.env["LOVABLE_API_KEY"]);
  const res = await googleFetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? ANDREA_FAST_MODEL,
      stream: true,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.input },
      ],
      ...(opts.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: opts.jsonSchema.name,
                strict: true,
                schema: opts.jsonSchema.schema,
              },
            },
          }
        : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Google AI-kvoten är tillfälligt nådd. Försök snart igen.");
    throw new Error(`Google AI Studio-fel (${res.status}): ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          choices?: { delta?: { content?: string }; message?: { content?: string } }[];
        };
        const delta = evt.choices?.[0]?.delta?.content ?? "";
        if (delta) text += delta;
      } catch {
        // ofullständigt event – ignorera
      }
    }
  }

  return text.trim();
}

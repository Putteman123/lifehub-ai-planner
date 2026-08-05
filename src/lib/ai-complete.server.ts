import { ANDREA_FAST_MODEL } from "@/lib/ai-models";

type JsonSchema = { name: string; schema: Record<string, unknown> };

/**
 * Kör ett strömmande textanrop mot Lovable AI Gateway (chat completions).
 * Gemini-modeller använder /v1/chat/completions, inte Responses-API:t.
 */
export async function completeText(opts: {
  apiKey: string;
  system: string;
  input: string;
  jsonSchema?: JsonSchema;
  model?: string;
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
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
    if (res.status === 429) throw new Error("För många AI-förfrågningar, försök snart igen.");
    if (res.status === 402) throw new Error("AI-krediterna är slut.");
    throw new Error(`AI-fel (${res.status})`);
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

import { ANDREA_FAST_MODEL, ANDREA_GATEWAY_MODEL } from "@/lib/ai-models";
import { createGoogleAiStudioFetch } from "@/lib/google-ai.server";

type JsonSchema = { name: string; schema: Record<string, unknown> };

const LOVABLE_FALLBACK_MODEL = ANDREA_GATEWAY_MODEL;

type Message = { role: "system" | "user"; content: string };

/** Läser ut texten ur ett OpenAI-kompatibelt SSE-svar. */
async function readStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
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

function jsonFormat(jsonSchema?: JsonSchema) {
  if (!jsonSchema) return {};
  return {
    response_format: {
      type: "json_schema",
      json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema },
    },
  };
}

/** Reservväg: Lovable AI när Googles nyckel eller kvot inte räcker. */
async function completeViaLovable(
  messages: Message[],
  jsonSchema?: JsonSchema,
): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI-tjänsten är inte tillgänglig just nu. Försök igen om en stund.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: LOVABLE_FALLBACK_MODEL,
      stream: true,
      messages,
      ...jsonFormat(jsonSchema),
    }),
  });

  if (!res.ok || !res.body) {
    if (res.status === 429)
      throw new Error("AI-tjänsten är hårt belastad just nu. Försök igen om en stund.");
    if (res.status === 402 || res.status === 403)
      throw new Error("AI-krediterna är slut – fyll på för att fortsätta använda Andrea.");
    throw new Error("AI-tjänsten kunde inte nås just nu. Försök igen om en stund.");
  }

  return readStream(res.body);
}

/**
 * Kör ett strömmande textanrop mot användarens Google AI Studio-konto och
 * faller tillbaka på Lovable AI om nyckeln, behörigheten eller kvoten fallerar.
 */
export async function completeText(opts: {
  apiKey?: string;
  system: string;
  input: string;
  jsonSchema?: JsonSchema;
  model?: string;
}): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.input },
  ];

  const apiKey = opts.apiKey ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return completeViaLovable(messages, opts.jsonSchema);

  let text = "";
  try {
    const googleFetch = createGoogleAiStudioFetch();
    const res = await googleFetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model ?? ANDREA_FAST_MODEL,
          stream: true,
          messages,
          ...jsonFormat(opts.jsonSchema),
        }),
      },
    );

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      console.warn(`Google AI Studio svarade ${res.status}: ${detail.slice(0, 300)}`);
      return await completeViaLovable(messages, opts.jsonSchema);
    }

    text = await readStream(res.body);
  } catch (error) {
    console.warn("Google AI Studio misslyckades, använder reservtjänsten.", error);
    return completeViaLovable(messages, opts.jsonSchema);
  }

  if (!text) return completeViaLovable(messages, opts.jsonSchema);
  return text;
}

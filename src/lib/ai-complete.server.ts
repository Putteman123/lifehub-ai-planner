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
 * Förstahandsval: användarens eget ChatGPT-konto (OPENAI_API_KEY).
 * Returnerar null om nyckeln saknas eller anropet misslyckas, så att
 * anroparen kan gå vidare i reservkedjan.
 */
async function completeViaOpenAI(
  messages: Message[],
  jsonSchema?: JsonSchema,
): Promise<string | null> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        stream: true,
        messages,
        ...jsonFormat(jsonSchema),
      }),
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      console.warn(`ChatGPT svarade ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }
    const text = await readStream(res.body);
    return text || null;
  } catch (error) {
    console.warn("ChatGPT misslyckades, provar nästa tjänst.", error);
    return null;
  }
}

/** Andrahandsval: användarens Google AI Studio-konto (GEMINI_API_KEY). */
async function completeViaGemini(
  messages: Message[],
  jsonSchema: JsonSchema | undefined,
  model: string,
  apiKeyOverride?: string,
): Promise<string | null> {
  const apiKey = apiKeyOverride ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
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
          model,
          stream: true,
          messages,
          ...jsonFormat(jsonSchema),
        }),
      },
    );
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      console.warn(`Google AI Studio svarade ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }
    const text = await readStream(res.body);
    return text || null;
  } catch (error) {
    console.warn("Google AI Studio misslyckades, provar reservtjänsten.", error);
    return null;
  }
}

/**
 * Kör ett strömmande textanrop i prioritetsordning:
 * ChatGPT (eget konto) → Gemini (eget konto) → Lovable AI (reserv).
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

  const openAiText = await completeViaOpenAI(messages, opts.jsonSchema);
  if (openAiText) return openAiText;

  const geminiText = await completeViaGemini(
    messages,
    opts.jsonSchema,
    opts.model ?? ANDREA_FAST_MODEL,
    opts.apiKey,
  );
  if (geminiText) return geminiText;

  return completeViaLovable(messages, opts.jsonSchema);
}

export type AiAttachment = { filename: string; mimeType: string; data: string };

type Block =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/**
 * Multimodalt anrop (PDF och bilder) via Lovable AI-gatewayen. Används när ett
 * mejl har bilagor – där ligger oftast kvittot eller fakturan.
 */
export async function completeVision(opts: {
  system: string;
  input: string;
  attachments: AiAttachment[];
  jsonSchema?: JsonSchema;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI-tjänsten är inte tillgänglig just nu. Försök igen om en stund.");

  const blocks: Block[] = [{ type: "text", text: opts.input }];
  for (const file of opts.attachments) {
    const url = `data:${file.mimeType};base64,${file.data}`;
    if (file.mimeType.startsWith("image/")) blocks.push({ type: "image_url", image_url: { url } });
    else blocks.push({ type: "file", file: { filename: file.filename, file_data: url } });
  }

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
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: blocks },
      ],
      ...jsonFormat(opts.jsonSchema),
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.warn(`Lovable AI (bilaga) svarade ${res.status}: ${detail.slice(0, 300)}`);
    if (res.status === 402 || res.status === 403)
      throw new Error("AI-krediterna är slut – fyll på för att fortsätta använda Andrea.");
    throw new Error("AI-tjänsten kunde inte läsa bilagan just nu.");
  }

  return readStream(res.body);
}

import { createFileRoute } from "@tanstack/react-router";

type Body = { text?: unknown };

type ElevenLabsSubscription = {
  character_count?: number;
  character_limit?: number;
  status?: string;
};

async function authenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;
  if (!bearer) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(bearer);
  return data?.user ?? null;
}

/** Naturlig, varm kvinnoröst (ElevenLabs "Charlotte", flerspråkig). */
const DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa";
const DEFAULT_VOICE_NAME = "Charlotte";
const PREFERRED_VOICE_NAME = "andrea";

type ElevenLabsVoice = { voice_id?: string; name?: string };

let voiceCache: { id: string; name: string } | null = null;
let voiceLookupPromise: Promise<{ id: string; name: string }> | null = null;

/**
 * Löser upp rösten "Andrea" på ElevenLabs-kontot via namn.
 * Prioritet: ELEVENLABS_VOICE_ID → rösten "Andrea" → standardrösten.
 */
async function resolveVoice(apiKey: string): Promise<{ id: string; name: string }> {
  const envId = process.env["ELEVENLABS_VOICE_ID"];
  if (envId) return { id: envId, name: "env" };
  if (voiceCache) return voiceCache;
  if (!voiceLookupPromise) {
    voiceLookupPromise = (async () => {
      try {
        const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": apiKey },
        });
        if (resp.ok) {
          const data = (await resp.json()) as { voices?: ElevenLabsVoice[] };
          const match = (data.voices ?? []).find(
            (v) => v.name?.trim().toLowerCase() === PREFERRED_VOICE_NAME && v.voice_id,
          );
          if (match?.voice_id) {
            voiceCache = { id: match.voice_id, name: match.name ?? "Andrea" };
            return voiceCache;
          }
        } else {
          console.error("ElevenLabs röstlista misslyckades:", resp.status);
        }
      } catch (error) {
        console.error("ElevenLabs röstupplösning misslyckades:", error);
      }
      voiceCache = { id: DEFAULT_VOICE_ID, name: DEFAULT_VOICE_NAME };
      return voiceCache;
    })().finally(() => {
      voiceLookupPromise = null;
    });
  }
  return voiceLookupPromise;
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await authenticatedUser(request))) {
          return Response.json({ available: false, errorType: "unauthorized" }, { status: 401 });
        }

        const elevenKey = process.env["ELEVENLABS_API_KEY"];
        if (!elevenKey) {
          return Response.json({
            service: "ElevenLabs",
            available: false,
            errorType: "missing_api_key",
            fallback: "Webbläsarens svenska röst",
          });
        }

        const started = Date.now();
        const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
          headers: { "xi-api-key": elevenKey },
        });
        const latencyMs = Date.now() - started;
        if (!response.ok) {
          return Response.json({
            service: "ElevenLabs",
            available: false,
            status: response.status,
            errorType: response.status === 401 ? "invalid_api_key" : "provider_error",
            latencyMs,
            fallback: "Webbläsarens svenska röst",
          });
        }

        const subscription = (await response.json()) as ElevenLabsSubscription;
        const used = subscription.character_count ?? null;
        const limit = subscription.character_limit ?? null;
        return Response.json({
          service: "ElevenLabs",
          available: true,
          status: 200,
          errorType: null,
          latencyMs,
          used,
          limit,
          remaining: used !== null && limit !== null ? Math.max(0, limit - used) : null,
          subscriptionStatus: subscription.status ?? null,
          fallback: "Webbläsarens svenska röst",
        });
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) return new Response("text required", { status: 400 });

        if (!(await authenticatedUser(request))) return new Response("Unauthorized", { status: 401 });

        const input = text.length > 900 ? `${text.slice(0, 900)}…` : text;

        const elevenKey = process.env["ELEVENLABS_API_KEY"];
        if (elevenKey) {
          const voiceId = process.env["ELEVENLABS_VOICE_ID"] || DEFAULT_VOICE_ID;
          const resp = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": elevenKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: input,
                model_id: "eleven_flash_v2_5",
                language_code: "sv",
                voice_settings: {
                  stability: 0.4,
                  similarity_boost: 0.8,
                  style: 0.2,
                  use_speaker_boost: true,
                },
              }),
            },
          );
          if (resp.ok && resp.body) {
            return new Response(resp.body, {
              headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
            });
          }
          const detail = await resp.text().catch(() => "");
          console.error("ElevenLabs TTS misslyckades:", resp.status, detail);
          // Faller vidare till Lovable-rösten om ElevenLabs inte svarar.
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Röst är inte konfigurerad.", { status: 500 });

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input,
            voice: "shimmer",
            response_format: "mp3",
            instructions:
              "Tala svenska med en varm, lugn och professionell kvinnoröst. Naturligt tempo.",
          }),
        });

        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          console.error("Lovable TTS misslyckades:", resp.status, detail);
          const text =
            resp.status === 402 || resp.status === 403
              ? "AI-krediterna är slut – rösten är pausad."
              : detail || "TTS misslyckades";
          return new Response(text, { status: resp.status });
        }

        return new Response(resp.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});

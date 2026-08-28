import { createFileRoute } from "@tanstack/react-router";

type Body = { text?: unknown };

/** Naturlig, varm kvinnoröst (ElevenLabs "Charlotte", flerspråkig). */
const DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) return new Response("text required", { status: 400 });

        const authHeader = request.headers.get("authorization");
        const bearer = authHeader?.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : null;
        if (!bearer) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData } = await supabaseAdmin.auth.getUser(bearer);
        if (!userData?.user) return new Response("Unauthorized", { status: 401 });

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
          console.error(
            "ElevenLabs TTS misslyckades:",
            resp.status,
            await resp.text().catch(() => ""),
          );
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

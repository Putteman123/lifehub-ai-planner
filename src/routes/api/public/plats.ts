import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Privat webhook för positioner från telefonen (OwnTracks eller Genvägar).
 * Skyddas av LOCATION_INGEST_TOKEN – utan rätt token händer ingenting.
 */
const payloadSchema = z
  .object({
    _type: z.string().optional(),
    _lifehub_test: z.boolean().optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180).optional(),
    lng: z.number().min(-180).max(180).optional(),
    acc: z.number().min(0).max(100000).optional(),
    accuracy: z.number().min(0).max(100000).optional(),
    tst: z.number().int().optional(),
    recorded_at: z.string().datetime().optional(),
  })
  .refine((v) => v.lon != null || v.lng != null, { message: "lon/lng saknas" });

function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Sparar spår av varje anrop så det går att felsöka telefonens koppling. */
async function log(
  outcome: string,
  request: Request,
  detail: string | null,
  hadToken: boolean,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("location_ingest_log").insert({
      outcome,
      detail,
      had_token: hadToken,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    });
  } catch {
    // Loggning får aldrig stoppa mottagningen.
  }
}

export const Route = createFileRoute("/api/public/plats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const header = request.headers.get("x-ingest-token");
        const provided = url.searchParams.get("token") ?? header ?? "";

        const expected = process.env["LOCATION_INGEST_TOKEN_V2"];
        if (!expected) {
          await log("saknar_nyckel_server", request, null, Boolean(provided));
          return new Response("Not configured", { status: 503 });
        }

        if (!timingSafeEqual(provided, expected)) {
          await log(
            provided ? "fel_nyckel" : "ingen_nyckel",
            request,
            provided ? "Token stämmer inte" : "Ingen token skickades med",
            Boolean(provided),
          );
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          await log("ogiltig_json", request, null, true);
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          // OwnTracks skickar även andra meddelandetyper – bekräfta tyst.
          const type =
            typeof body === "object" && body !== null && "_type" in body
              ? String((body as Record<string, unknown>)["_type"])
              : "okänd";
          await log("annan_typ", request, `_type=${type}`, true);
          return Response.json({ ok: true, ignored: true });
        }

        if (parsed.data._lifehub_test) {
          await log("test_ok", request, "Korrekt OwnTracks-format och nyckel", true);
          return Response.json({ ok: true, test: true });
        }

        const { recordPosition, ownerUserId } = await import("@/lib/visit-tracking.server");
        const userId = await ownerUserId();
        if (!userId) {
          await log("ingen_agare", request, null, true);
          return new Response("Owner not found", { status: 503 });
        }

        const data = parsed.data;
        const longitude = data.lon ?? data.lng;
        if (longitude == null) {
          await log("ogiltig_json", request, "lon/lng saknas", true);
          return new Response("Invalid coordinates", { status: 400 });
        }
        const recordedAt = data.recorded_at
          ? data.recorded_at
          : data.tst
            ? new Date(data.tst * 1000).toISOString()
            : new Date().toISOString();

        await recordPosition(userId, {
          lat: data.lat,
          lng: longitude,
          accuracy_m: data.acc ?? data.accuracy ?? null,
          recorded_at: recordedAt,
          source: "telefon",
        });

        await log("ok", request, null, true);
        return Response.json({ ok: true });
      },
      GET: async ({ request }) => {
        const provided = new URL(request.url).searchParams.get("token") ?? "";
        const expected = process.env["LOCATION_INGEST_TOKEN_V2"];
        if (!expected || !timingSafeEqual(provided, expected)) {
          await log(provided ? "fel_nyckel" : "ingen_nyckel", request, "GET-kontroll", Boolean(provided));
          return new Response("Unauthorized", { status: 401 });
        }
        await log("get_test", request, "Adressen nådd i webbläsare", true);
        return Response.json({
          ok: true,
          hint: "Adressen och nyckeln är rätt. En position måste fortfarande skickas från OwnTracks.",
        });
      },
    },
  },
});


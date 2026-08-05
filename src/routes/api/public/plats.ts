import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Privat webhook för positioner från telefonen (OwnTracks eller Genvägar).
 * Skyddas av LOCATION_INGEST_TOKEN – utan rätt token händer ingenting.
 */
const payloadSchema = z
  .object({
    _type: z.string().optional(),
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

export const Route = createFileRoute("/api/public/plats")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["LOCATION_INGEST_TOKEN"];
        if (!expected) return new Response("Not configured", { status: 503 });

        const url = new URL(request.url);
        const header = request.headers.get("x-ingest-token");
        const provided = url.searchParams.get("token") ?? header ?? "";
        if (!timingSafeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          // OwnTracks skickar även andra meddelandetyper – bekräfta tyst.
          return Response.json({ ok: true, ignored: true });
        }

        const { recordPosition, ownerUserId } = await import("@/lib/visit-tracking.server");
        const userId = await ownerUserId();
        if (!userId) return new Response("Owner not found", { status: 503 });

        const data = parsed.data;
        const recordedAt = data.recorded_at
          ? data.recorded_at
          : data.tst
            ? new Date(data.tst * 1000).toISOString()
            : new Date().toISOString();

        await recordPosition(userId, {
          lat: data.lat,
          lng: (data.lon ?? data.lng)!,
          accuracy_m: data.acc ?? data.accuracy ?? null,
          recorded_at: recordedAt,
          source: "telefon",
        });

        return Response.json({ ok: true });
      },
    },
  },
});

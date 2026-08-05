import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const positionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100000).nullable().optional(),
  source: z.enum(["app", "live", "manual"]).optional(),
});

/** Registrerar min nuvarande position och uppdaterar besöksloggen. */
export const recordMyPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => positionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { recordPosition } = await import("@/lib/visit-tracking.server");
    const result = await recordPosition(context.userId, {
      lat: data.lat,
      lng: data.lng,
      accuracy_m: data.accuracy_m ?? null,
      source: data.source ?? "app",
    });
    return result;
  });

/** Stänger pågående besök ("Jag går nu"). */
export const endMyVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { closeOpenVisit } = await import("@/lib/visit-tracking.server");
    const closed = await closeOpenVisit(context.userId);
    return { closed };
  });

/** Ger den privata webhook-adressen som telefonen ska posta till. */
export const getIngestInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const token = process.env["LOCATION_INGEST_TOKEN"] ?? "";
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const origin = new URL(request.url).origin;
    return {
      url: `${origin}/api/public/plats?token=${encodeURIComponent(token)}`,
      configured: Boolean(token),
    };
  });

/** Raderar all platshistorik (positioner och besök). */
export const clearLocationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("visits").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("location_pings").delete().eq("user_id", context.userId);
    return { ok: true };
  });

const nameVisitSchema = z.object({
  visitId: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  note: z.string().trim().max(120).optional().default(""),
  kind: z.enum(["jobb", "jurist", "hem", "barn", "annat"]),
  saveAsPlace: z.boolean().optional().default(false),
});

/** Namnger ett okänt besök och kan spara det som en fast plats. */
export const nameVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => nameVisitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { PLACE_KINDS, haversineMeters } = await import("@/lib/geo");
    const supabase = context.supabase;

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("*")
      .eq("id", data.visitId)
      .maybeSingle();
    if (visitError) throw new Error(visitError.message);
    if (!visit) throw new Error("Besöket hittades inte.");

    const note = data.note || null;
    let placeId: string | null = visit.place_id;
    let linked = 0;

    if (data.saveAsPlace && visit.lat != null && visit.lng != null) {
      const radius = 150;
      const color = PLACE_KINDS.find((k) => k.value === data.kind)?.color ?? "#64748b";
      const { data: place, error: placeError } = await supabase
        .from("places")
        .insert({
          user_id: context.userId,
          name: data.label,
          kind: data.kind,
          lat: visit.lat,
          lng: visit.lng,
          radius_m: radius,
          color,
        })
        .select("id")
        .single();
      if (placeError) throw new Error(placeError.message);
      placeId = place.id;

      const { data: orphans, error: orphanError } = await supabase
        .from("visits")
        .select("id, lat, lng")
        .is("place_id", null);
      if (orphanError) throw new Error(orphanError.message);

      const nearby = (orphans ?? []).filter(
        (v) =>
          v.lat != null &&
          v.lng != null &&
          haversineMeters(v.lat, v.lng, visit.lat!, visit.lng!) <= radius,
      );
      if (nearby.length > 0) {
        const { error: linkError } = await supabase
          .from("visits")
          .update({ place_id: placeId, label: data.label })
          .in(
            "id",
            nearby.map((v) => v.id),
          );
        if (linkError) throw new Error(linkError.message);
        linked = nearby.length;
      }
    }

    const { error: updateError } = await supabase
      .from("visits")
      .update({ label: data.label, note, place_id: placeId })
      .eq("id", data.visitId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true, placeId, linked };
  });

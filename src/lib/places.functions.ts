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

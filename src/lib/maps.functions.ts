import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const legSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  mode: z.enum(["bil", "kollektivt", "gang_cykel"]).optional(),
});

export type RouteLegInput = z.infer<typeof legSchema>;

export type RouteLegResult = {
  meters: number;
  minutes: number;
  polyline: string | null;
} | null;

/** Verklig körsträcka och restid mellan två punkter enligt Google Maps. */
export const routeBetween = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => legSchema.parse(input))
  .handler(async ({ data }): Promise<RouteLegResult> => {
    const { resolveLeg } = await import("./maps.server");
    return resolveLeg(data);
  });

/** Flera sträckor på en gång – används av veckans reseplan. */
export const routeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ legs: z.array(legSchema).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<RouteLegResult[]> => {
    const { resolveLegs } = await import("./maps.server");
    return resolveLegs(data.legs);
  });

/** Adressförslag för en koordinat. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pointSchema.parse(input))
  .handler(async ({ data }) => {
    const { resolvePlaceName } = await import("./maps.server");
    return resolvePlaceName(data.lat, data.lng);
  });

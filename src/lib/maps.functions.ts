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

/** Avståndsmatris – hur långt och hur länge mellan flera punkter. */
export const distanceMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        origins: z.array(pointSchema).min(1).max(10),
        destinations: z.array(pointSchema).min(1).max(10),
        mode: z.enum(["bil", "kollektivt", "gang_cykel"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveMatrix } = await import("./maps.server");
    return resolveMatrix(data.origins, data.destinations, data.mode ?? "bil");
  });

/** Platsförslag medan man skriver. */
export const placeAutocomplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        input: z.string().min(1).max(200),
        bias: pointSchema.nullable().optional(),
        sessionToken: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { suggestPlaces } = await import("./maps.server");
    return suggestPlaces(data.input, data.bias ?? null, data.sessionToken);
  });

/** Detaljer för ett valt platsförslag. */
export const placeLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ placeId: z.string().min(1).max(300), sessionToken: z.string().max(80).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolvePlaceDetails } = await import("./maps.server");
    return resolvePlaceDetails(data.placeId, data.sessionToken);
  });

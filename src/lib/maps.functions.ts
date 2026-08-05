import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RouteLegInput = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: "bil" | "kollektivt" | "gang_cykel";
};

export type RouteLegResult = {
  meters: number;
  minutes: number;
  polyline: string | null;
} | null;

/** Verklig körsträcka och restid mellan två punkter enligt Google Maps. */
export const routeBetween = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RouteLegInput) => {
    const { validateLeg } = require("./maps.server") as typeof import("./maps.server");
    return validateLeg(input);
  })
  .handler(async ({ data }): Promise<RouteLegResult> => {
    const { resolveLeg } = await import("./maps.server");
    return resolveLeg(data);
  });

/** Flera sträckor på en gång – används av veckans reseplan. */
export const routeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { legs: RouteLegInput[] }) => {
    const { validateLegs } = require("./maps.server") as typeof import("./maps.server");
    return validateLegs(input);
  })
  .handler(async ({ data }): Promise<RouteLegResult[]> => {
    const { resolveLegs } = await import("./maps.server");
    return resolveLegs(data.legs);
  });

/** Adressförslag för en koordinat. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lat: number; lng: number }) => {
    const { validatePoint } = require("./maps.server") as typeof import("./maps.server");
    return validatePoint(input);
  })
  .handler(async ({ data }) => {
    const { resolvePlaceName } = await import("./maps.server");
    return resolvePlaceName(data.lat, data.lng);
  });

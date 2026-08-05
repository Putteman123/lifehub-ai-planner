/**
 * Kartlogik som bara får köras på servern (anropar Google via gatewayen).
 */
import { estimateRouteMeters } from "./geo";
import { geocodeLatLng, hasGoogle, mapsRoute } from "./google.server";

export type Point = { lat: number; lng: number };
export type TravelKind = "bil" | "kollektivt" | "gang_cykel";

export type ResolvedLeg = {
  meters: number;
  minutes: number;
  polyline: string | null;
} | null;

/** Google-rutt om det går, annars null så anroparen kan falla tillbaka. */
export async function resolveLeg(input: {
  origin: Point;
  destination: Point;
  mode?: TravelKind;
}): Promise<ResolvedLeg> {
  if (!hasGoogle("maps")) return null;
  try {
    const route = await mapsRoute(input.origin, input.destination, input.mode ?? "bil");
    if (!route.meters) return null;
    return { meters: route.meters, minutes: route.minutes, polyline: route.polyline };
  } catch (error) {
    console.error("Google Maps-rutt misslyckades:", error);
    return null;
  }
}

/** Flera sträckor med begränsad parallellitet. */
export async function resolveLegs(
  legs: Array<{ origin: Point; destination: Point; mode?: TravelKind }>,
): Promise<ResolvedLeg[]> {
  const results: ResolvedLeg[] = new Array(legs.length).fill(null);
  const size = 5;
  for (let i = 0; i < legs.length; i += size) {
    const slice = legs.slice(i, i + size);
    const resolved = await Promise.all(slice.map((leg) => resolveLeg(leg)));
    resolved.forEach((value, index) => {
      results[i + index] = value;
    });
  }
  return results;
}

/** Verklig körsträcka i meter, med fågelvägsuppskattning som reserv. */
export async function routeMetersOrEstimate(
  origin: Point,
  destination: Point,
  mode: TravelKind = "bil",
): Promise<{ meters: number; source: "google" | "uppskattad" }> {
  const leg = await resolveLeg({ origin, destination, mode });
  if (leg?.meters) return { meters: leg.meters, source: "google" };
  return {
    meters: estimateRouteMeters(origin.lat, origin.lng, destination.lat, destination.lng),
    source: "uppskattad",
  };
}

/** Adress/namnförslag för en punkt. */
export async function resolvePlaceName(lat: number, lng: number) {
  if (!hasGoogle("maps")) return null;
  try {
    return await geocodeLatLng(lat, lng);
  } catch (error) {
    console.error("Google-geokodning misslyckades:", error);
    return null;
  }
}

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { haversineMeters, matchPlace } from "@/lib/geo";

export type PositionInput = {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  recorded_at?: string;
  source?: string;
};

const MIN_VISIT_MINUTES = 5;
const STALE_GAP_MS = 2 * 60 * 60 * 1000;
const UNKNOWN_RADIUS_M = 250;

/**
 * Sparar en position och håller besöksloggen uppdaterad:
 * samma plats som senast → förläng besöket, annars stäng och öppna nytt.
 * Besök kortare än fem minuter kastas för att loggen ska vara läsbar.
 */
export async function recordPosition(userId: string, input: PositionInput) {
  const recordedAt = input.recorded_at ? new Date(input.recorded_at) : new Date();
  const iso = recordedAt.toISOString();
  const source = input.source ?? "app";

  await supabaseAdmin.from("location_pings").insert({
    user_id: userId,
    lat: input.lat,
    lng: input.lng,
    accuracy_m: input.accuracy_m ?? null,
    recorded_at: iso,
    source,
  });

  const { data: places } = await supabaseAdmin
    .from("places")
    .select("*")
    .eq("user_id", userId);

  const place = matchPlace(places ?? [], input.lat, input.lng);

  const { data: latest } = await supabaseAdmin
    .from("visits")
    .select("*")
    .eq("user_id", userId)
    .order("arrived_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const open = latest && !latest.left_at ? latest : null;

  if (open) {
    const samePlace = place
      ? open.place_id === place.id
      : open.place_id === null &&
        open.lat != null &&
        open.lng != null &&
        haversineMeters(input.lat, input.lng, open.lat, open.lng) <= UNKNOWN_RADIUS_M;

    const stale =
      recordedAt.getTime() - new Date(open.arrived_at).getTime() > STALE_GAP_MS && !samePlace;

    if (samePlace && !stale) {
      await supabaseAdmin
        .from("visits")
        .update({ lat: input.lat, lng: input.lng })
        .eq("id", open.id);
      return { visitId: open.id, placeId: place?.id ?? null, continued: true };
    }

    await closeVisit(open.id, iso);
  }

  const { data: created } = await supabaseAdmin
    .from("visits")
    .insert({
      user_id: userId,
      place_id: place?.id ?? null,
      label: place ? null : "Okänd plats",
      lat: input.lat,
      lng: input.lng,
      arrived_at: iso,
      source,
    })
    .select("id")
    .maybeSingle();

  return { visitId: created?.id ?? null, placeId: place?.id ?? null, continued: false };
}

/** Stänger ett besök och tar bort det om det var för kort. */
export async function closeVisit(visitId: string, atIso: string) {
  const { data: visit } = await supabaseAdmin
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return;

  const minutes = (new Date(atIso).getTime() - new Date(visit.arrived_at).getTime()) / 60000;

  if (minutes < MIN_VISIT_MINUTES && !visit.is_manual) {
    await supabaseAdmin.from("visits").delete().eq("id", visitId);
    return;
  }

  await supabaseAdmin.from("visits").update({ left_at: atIso }).eq("id", visitId);
}

/** Stänger det öppna besöket för användaren, om något finns. */
export async function closeOpenVisit(userId: string, atIso = new Date().toISOString()) {
  const { data: open } = await supabaseAdmin
    .from("visits")
    .select("id")
    .eq("user_id", userId)
    .is("left_at", null)
    .order("arrived_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return false;
  await closeVisit(open.id, atIso);
  return true;
}

/** Slår upp ägarens användar-id utifrån APP_OWNER_EMAIL (enanvändarläge). */
export async function ownerUserId(): Promise<string | null> {
  const email = process.env["APP_OWNER_EMAIL"];
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

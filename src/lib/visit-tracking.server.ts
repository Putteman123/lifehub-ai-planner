import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MIN_TRAVEL_METERS,
  MIN_TRAVEL_MINUTES,
  TRAVEL_SPEED_MS,
  haversineMeters,
  matchPlace,
} from "@/lib/geo";

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
/** Punkter äldre än så här används inte för hastighetsberäkning. */
const SPEED_WINDOW_MS = 60 * 60 * 1000;

/**
 * Sparar en position och håller platsloggen uppdaterad.
 *
 * Rör sig positionen snabbt (över ~8 km/h) utanför kända platser tolkas det
 * som en resa, och sträckan summeras löpande från punkt till punkt. Stannar
 * rörelsen stängs resan och ett besök öppnas i stället. Besök kortare än fem
 * minuter och resor kortare än 500 m kastas så loggen förblir läsbar.
 */
export async function recordPosition(userId: string, input: PositionInput) {
  const recordedAt = input.recorded_at ? new Date(input.recorded_at) : new Date();
  const iso = recordedAt.toISOString();
  const source = input.source ?? "app";

  const { data: previousPing } = await supabaseAdmin
    .from("location_pings")
    .select("lat, lng, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabaseAdmin.from("location_pings").insert({
    user_id: userId,
    lat: input.lat,
    lng: input.lng,
    accuracy_m: input.accuracy_m ?? null,
    recorded_at: iso,
    source,
  });

  let stepMeters = 0;
  let speedMs = 0;
  if (previousPing) {
    const dtMs = recordedAt.getTime() - new Date(previousPing.recorded_at).getTime();
    if (dtMs > 0 && dtMs <= SPEED_WINDOW_MS) {
      stepMeters = haversineMeters(previousPing.lat, previousPing.lng, input.lat, input.lng);
      speedMs = stepMeters / (dtMs / 1000);
    }
  }

  const { data: places } = await supabaseAdmin.from("places").select("*").eq("user_id", userId);
  const place = matchPlace(places ?? [], input.lat, input.lng);
  const moving = !place && speedMs >= TRAVEL_SPEED_MS;

  // Städa bort gamla hängande poster innan vi tittar på det aktuella besöket.
  await closeStaleVisits(userId, recordedAt);

  const { data: latest } = await supabaseAdmin
    .from("visits")
    .select("*")
    .eq("user_id", userId)
    .order("arrived_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let open = latest && !latest.left_at ? latest : null;



  if (open && open.entry_kind === "resa") {
    if (moving) {
      await supabaseAdmin
        .from("visits")
        .update({
          lat: input.lat,
          lng: input.lng,
          end_lat: input.lat,
          end_lng: input.lng,
          distance_m: (open.distance_m ?? 0) + stepMeters,
        })
        .eq("id", open.id);
      return { visitId: open.id, placeId: null, continued: true, travel: true };
    }
    await supabaseAdmin
      .from("visits")
      .update({
        end_lat: input.lat,
        end_lng: input.lng,
        distance_m: (open.distance_m ?? 0) + stepMeters,
        label: place ? `Resa till ${place.name}` : open.label,
      })
      .eq("id", open.id);
    await closeVisit(open.id, iso);
  } else if (open) {
    const samePlace = place
      ? open.place_id === place.id
      : open.place_id === null &&
        !moving &&
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
      return { visitId: open.id, placeId: place?.id ?? null, continued: true, travel: false };
    }

    await closeVisit(open.id, iso);
  }

  const startLabel = open
    ? (open.place_id ? (places ?? []).find((p) => p.id === open.place_id)?.name : open.label) ?? null
    : null;

  const { data: created } = await supabaseAdmin
    .from("visits")
    .insert(
      moving
        ? {
            user_id: userId,
            entry_kind: "resa" as const,
            place_id: null,
            label: startLabel ? `Resa från ${startLabel}` : "Resa",
            lat: input.lat,
            lng: input.lng,
            end_lat: input.lat,
            end_lng: input.lng,
            distance_m: stepMeters,
            arrived_at: iso,
            source,
          }
        : {
            user_id: userId,
            entry_kind: "besok" as const,
            place_id: place?.id ?? null,
            label: place ? null : "Okänd plats",
            lat: input.lat,
            lng: input.lng,
            arrived_at: iso,
            source,
          },
    )
    .select("id")
    .maybeSingle();

  return {
    visitId: created?.id ?? null,
    placeId: place?.id ?? null,
    continued: false,
    travel: moving,
  };
}

/** Stänger ett besök eller en resa och tar bort posten om den var för kort. */
export async function closeVisit(visitId: string, atIso: string) {
  const { data: visit } = await supabaseAdmin
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return;

  const minutes = (new Date(atIso).getTime() - new Date(visit.arrived_at).getTime()) / 60000;

  if (visit.entry_kind === "resa") {
    if (minutes < MIN_TRAVEL_MINUTES || (visit.distance_m ?? 0) < MIN_TRAVEL_METERS) {
      await supabaseAdmin.from("visits").delete().eq("id", visitId);
      return;
    }
  } else if (minutes < MIN_VISIT_MINUTES && !visit.is_manual) {
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

/** Slår upp ägarens användar-id: i första hand kontot som äger appens data. */
export async function ownerUserId(): Promise<string | null> {
  const { data: owner } = await supabaseAdmin
    .from("app_owner")
    .select("user_id")
    .maybeSingle();
  if (owner?.user_id) return owner.user_id;

  const email = process.env["APP_OWNER_EMAIL"];
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

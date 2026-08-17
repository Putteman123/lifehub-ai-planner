import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { distanceMatches, guessTravelMode, type PlaceRow, type VisitRow } from "@/lib/geo";
import { endpointKey, weekdayIndex } from "@/lib/route-key";

type Client = SupabaseClient<Database>;
type TravelMode = VisitRow["travel_mode"];

type Point = { lat: number; lng: number } | null;

function visitStart(visit: VisitRow, places: PlaceRow[]): Point {
  if (visit.place_id) {
    const place = places.find((p) => p.id === visit.place_id);
    if (place) return { lat: place.lat, lng: place.lng };
  }
  if (visit.lat != null && visit.lng != null) return { lat: visit.lat, lng: visit.lng };
  return null;
}

function visitEnd(visit: VisitRow, places: PlaceRow[]): Point {
  if (visit.end_lat != null && visit.end_lng != null) {
    return { lat: visit.end_lat, lng: visit.end_lng };
  }
  return visitStart(visit, places);
}

/** Gissar färdsätt utifrån snitthastighet och sträcka. */
function guessMode(meters: number, minutes: number): TravelMode {
  return guessTravelMode(meters, minutes);
}

async function loadContext(supabase: Client, userId: string, visitId: string) {
  const [{ data: visit, error }, { data: places }] = await Promise.all([
    supabase.from("visits").select("*").eq("id", visitId).maybeSingle(),
    supabase.from("places").select("*").eq("user_id", userId),
  ]);
  if (error) throw new Error(error.message);
  if (!visit) throw new Error("Besöket hittades inte.");
  return { visit: visit as VisitRow, places: (places ?? []) as PlaceRow[] };
}

async function logEdits(
  supabase: Client,
  userId: string,
  visitId: string,
  changes: { field: string; old_value: string | null; new_value: string | null }[],
) {
  if (changes.length === 0) return;
  await supabase
    .from("visit_edits")
    .insert(changes.map((c) => ({ ...c, visit_id: visitId, user_id: userId })));
}

/**
 * Markerar ett besök som resa och låter appen fylla i resten:
 * start/slut från intilliggande besök, sträcka, verifiering och färdsätt.
 */
export async function markVisitAsTravel(supabase: Client, userId: string, visitId: string) {
  const { visit, places } = await loadContext(supabase, userId, visitId);
  const before: Record<string, string | null> = {
    entry_kind: visit.entry_kind,
    distance_m: String(visit.distance_m ?? 0),
    travel_mode: visit.travel_mode,
    distance_verified: String(visit.distance_verified),
  };

  const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
    supabase
      .from("visits")
      .select("*")
      .eq("user_id", userId)
      .neq("id", visitId)
      .lte("arrived_at", visit.arrived_at)
      .order("arrived_at", { ascending: false })
      .limit(1),
    supabase
      .from("visits")
      .select("*")
      .eq("user_id", userId)
      .neq("id", visitId)
      .gte("arrived_at", visit.left_at ?? visit.arrived_at)
      .order("arrived_at", { ascending: true })
      .limit(1),
  ]);

  const prev = (prevRows?.[0] as VisitRow | undefined) ?? null;
  const next = (nextRows?.[0] as VisitRow | undefined) ?? null;

  const start =
    (prev ? visitEnd(prev, places) : null) ??
    (visit.lat != null && visit.lng != null ? { lat: visit.lat, lng: visit.lng } : null);
  const end =
    (next ? visitStart(next, places) : null) ??
    (visit.end_lat != null && visit.end_lng != null
      ? { lat: visit.end_lat, lng: visit.end_lng }
      : start);

  // Verklig körsträcka från Google Maps, annars uppskattning.
  let estimate = 0;
  if (start && end) {
    const { routeMetersOrEstimate } = await import("./maps.server");
    estimate = (await routeMetersOrEstimate(start, end)).meters;
  }
  const distance = estimate > 0 ? estimate : (visit.distance_m ?? 0);

  const startMs = new Date(visit.arrived_at).getTime();
  const endMs = new Date(visit.left_at ?? visit.arrived_at).getTime();
  const minutes = Math.max(0, Math.round((endMs - startMs) / 60000));

  // Preferens för rutten eller veckodagen vinner över gissningen.
  const fromName = endpointKey(start, places, "Okänd start");
  const toName = endpointKey(end, places, "Okänt mål");
  const routeKey = `${fromName}→${toName}`;
  const weekday = weekdayIndex(new Date(visit.arrived_at));
  const { data: prefs } = await supabase
    .from("travel_preferences")
    .select("kind, route_key, weekday, preferred_mode")
    .eq("user_id", userId);

  const routePref = prefs?.find((p) => p.kind === "rutt" && p.route_key === routeKey);
  const dayPref = prefs?.find((p) => p.kind === "veckodag" && p.weekday === weekday);
  const guessed = guessMode(distance, minutes);
  const mode = (routePref?.preferred_mode ?? dayPref?.preferred_mode ?? guessed) as TravelMode;

  const verified = estimate > 0 && distanceMatches(distance, estimate);
  const label = start && end ? `${fromName} → ${toName}` : "Resa";

  const patch = {
    entry_kind: "resa" as const,
    distance_m: distance,
    distance_verified: verified,
    travel_mode: mode,
    label,
    place_id: null,
    lat: start?.lat ?? visit.lat,
    lng: start?.lng ?? visit.lng,
    end_lat: end?.lat ?? visit.end_lat,
    end_lng: end?.lng ?? visit.end_lng,
  };

  const { error: updateError } = await supabase
    .from("visits")
    .update(patch)
    .eq("id", visitId)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);

  await logEdits(supabase, userId, visitId, [
    { field: "entry_kind", old_value: before["entry_kind"] ?? null, new_value: "resa" },
    { field: "distance_m", old_value: before["distance_m"] ?? null, new_value: String(distance) },
    { field: "travel_mode", old_value: before["travel_mode"] ?? null, new_value: mode },
    {
      field: "distance_verified",
      old_value: before["distance_verified"] ?? null,
      new_value: String(verified),
    },
  ]);

  return {
    ok: true,
    visitId,
    label,
    distance_m: distance,
    travel_mode: mode,
    distance_verified: verified,
    minutes,
    routeKey,
    weekday,
    usedPreference: Boolean(routePref ?? dayPref),
    previous: {
      entry_kind: visit.entry_kind,
      distance_m: visit.distance_m ?? 0,
      travel_mode: visit.travel_mode,
      distance_verified: visit.distance_verified,
      label: visit.label,
      place_id: visit.place_id,
    },
  };
}

/** Återställer ett besök som felaktigt markerats som resa. */
export async function undoTravel(
  supabase: Client,
  userId: string,
  visitId: string,
  previous: {
    entry_kind: "besok" | "resa";
    distance_m: number;
    travel_mode: TravelMode;
    distance_verified: boolean;
    label: string | null;
    place_id: string | null;
  },
) {
  const { error } = await supabase
    .from("visits")
    .update(previous)
    .eq("id", visitId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Slår ihop flera reseposter i följd till en enda resa. */
export async function mergeTravelVisits(supabase: Client, userId: string, visitIds: string[]) {
  if (visitIds.length < 2) throw new Error("Välj minst två resor att slå ihop.");
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("user_id", userId)
    .in("id", visitIds)
    .order("arrived_at", { ascending: true });
  if (error) throw new Error(error.message);
  const trips = (data ?? []) as VisitRow[];
  if (trips.length < 2) throw new Error("Hittade inte resorna.");

  const first = trips[0]!;
  const last = trips[trips.length - 1]!;
  const distance = trips.reduce((sum, t) => sum + (t.distance_m ?? 0), 0);
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(last.left_at ?? last.arrived_at).getTime() -
        new Date(first.arrived_at).getTime()) /
        60000,
    ),
  );
  const mode = (trips.find((t) => t.travel_mode !== "okant")?.travel_mode ??
    guessMode(distance, minutes)) as TravelMode;

  const { error: updateError } = await supabase
    .from("visits")
    .update({
      entry_kind: "resa",
      arrived_at: first.arrived_at,
      left_at: last.left_at,
      lat: first.lat,
      lng: first.lng,
      end_lat: last.end_lat ?? last.lat,
      end_lng: last.end_lng ?? last.lng,
      distance_m: distance,
      travel_mode: mode,
      distance_verified: false,
    })
    .eq("id", first.id)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);

  const rest = trips.slice(1).map((t) => t.id);
  await supabase.from("visit_edits").delete().in("visit_id", rest);
  const { error: deleteError } = await supabase.from("visits").delete().in("id", rest);
  if (deleteError) throw new Error(deleteError.message);

  await logEdits(supabase, userId, first.id, [
    {
      field: "distance_m",
      old_value: String(first.distance_m ?? 0),
      new_value: String(distance),
    },
    { field: "left_at", old_value: first.left_at, new_value: last.left_at },
  ]);

  return {
    ok: true,
    visitId: first.id,
    distance_m: distance,
    minutes,
    travel_mode: mode,
    // Ögonblicksbild av originalposterna så att sammanslagningen kan ångras.
    snapshot: trips.map((t) => ({
      id: t.id,
      place_id: t.place_id,
      label: t.label,
      lat: t.lat,
      lng: t.lng,
      end_lat: t.end_lat,
      end_lng: t.end_lng,
      arrived_at: t.arrived_at,
      left_at: t.left_at,
      source: t.source,
      is_manual: t.is_manual,
      note: t.note,
      entry_kind: t.entry_kind,
      distance_m: t.distance_m,
      distance_verified: t.distance_verified,
      travel_mode: t.travel_mode,
    })),
  };
}

export type MergeSnapshotRow = Awaited<ReturnType<typeof mergeTravelVisits>>["snapshot"][number];

/** Återställer originalposterna efter en sammanslagning. */
export async function undoMergeTravelVisits(
  supabase: Client,
  userId: string,
  snapshot: MergeSnapshotRow[],
) {
  if (snapshot.length < 2) throw new Error("Ingen sammanslagning att ångra.");
  const rows = snapshot.map((row) => ({ ...row, user_id: userId }));
  const { error } = await supabase.from("visits").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { ok: true, restored: rows.length };
}

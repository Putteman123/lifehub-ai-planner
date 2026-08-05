import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Åtgärder som Andrea får utföra i appen. Alla körningar sker mot ägarens
 * användar-id och returnerar en kort svensk bekräftelse som modellen kan citera.
 */

type Ok = { ok: true; message: string; id?: string };

function ok(message: string, id?: string): Ok {
  return id ? { ok: true, message, id } : { ok: true, message };
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function iso(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Ogiltigt datum: ${value}`);
  return d.toISOString();
}

export type EventInput = {
  title: string;
  starts_at: string;
  ends_at: string;
  category: "jobb" | "ledig" | "jurist" | "barn" | "privat" | "viktigt";
  all_day?: boolean | undefined;
  location?: string | undefined;
  description?: string | undefined;
};

export async function createEvent(userId: string, input: EventInput) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .insert({
      user_id: userId,
      title: input.title,
      starts_at: iso(input.starts_at),
      ends_at: iso(input.ends_at),
      category: input.category,
      all_day: input.all_day ?? false,
      location: input.location ?? null,
      description: input.description ?? null,
    })
    .select("id")
    .single();
  fail(error);
  return ok(`Händelsen "${input.title}" är inlagd.`, data?.id);
}

export async function updateEvent(
  userId: string,
  input: { event_id: string } & { [K in keyof EventInput]?: EventInput[K] | undefined },
) {
  const patch: TablesUpdate<"events"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.starts_at !== undefined) patch.starts_at = iso(input.starts_at);
  if (input.ends_at !== undefined) patch.ends_at = iso(input.ends_at);
  if (input.category !== undefined) patch.category = input.category;
  if (input.all_day !== undefined) patch.all_day = input.all_day;
  if (input.location !== undefined) patch.location = input.location;
  if (input.description !== undefined) patch.description = input.description;

  if (Object.keys(patch).length === 0) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("events")
    .update(patch)
    .eq("id", input.event_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Händelsen är uppdaterad.");
}

export async function deleteEvent(userId: string, eventId: string) {
  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);
  fail(error);
  return ok("Händelsen är borttagen.");
}

export async function createTodo(
  userId: string,
  input: { title: string; due_date?: string | undefined; notes?: string | undefined },
) {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .insert({
      user_id: userId,
      title: input.title,
      due_date: input.due_date ? iso(input.due_date) : null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  fail(error);
  return ok(`Uppgiften "${input.title}" ligger i Att göra.`, data?.id);
}

export async function completeTodo(userId: string, todoId: string, done = true) {
  const { error } = await supabaseAdmin
    .from("todos")
    .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", todoId)
    .eq("user_id", userId);
  fail(error);
  return ok(done ? "Uppgiften är avbockad och arkiverad." : "Uppgiften är återöppnad.");
}

export async function deleteTodo(userId: string, todoId: string) {
  const { error } = await supabaseAdmin
    .from("todos")
    .delete()
    .eq("id", todoId)
    .eq("user_id", userId);
  fail(error);
  return ok("Uppgiften är borttagen.");
}

export async function createReminder(
  userId: string,
  input: { title: string; remind_at: string },
) {
  const { data, error } = await supabaseAdmin
    .from("reminders")
    .insert({ user_id: userId, title: input.title, remind_at: iso(input.remind_at) })
    .select("id")
    .single();
  fail(error);
  return ok(`Påminnelse "${input.title}" skapad.`, data?.id);
}

export async function createCase(
  userId: string,
  input: { title: string; client_name?: string | undefined; description?: string | undefined },
) {
  const { data, error } = await supabaseAdmin
    .from("legal_cases")
    .insert({
      user_id: userId,
      title: input.title,
      client_name: input.client_name ?? null,
      description: input.description ?? null,
    })
    .select("id")
    .single();
  fail(error);
  return ok(`Ärendet "${input.title}" är upplagt.`, data?.id);
}

export async function createCaseTask(
  userId: string,
  input: { title: string; due_date?: string | undefined; case_id?: string | undefined; notes?: string | undefined },
) {
  const { data, error } = await supabaseAdmin
    .from("case_tasks")
    .insert({
      user_id: userId,
      title: input.title,
      due_date: input.due_date ? iso(input.due_date) : null,
      case_id: input.case_id ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  fail(error);
  return ok(`Juristuppgiften "${input.title}" är tillagd.`, data?.id);
}

export async function createChild(
  userId: string,
  input: { name: string; birth_date?: string | undefined; color?: string | undefined },
) {
  const { data, error } = await supabaseAdmin
    .from("children")
    .insert({
      user_id: userId,
      name: input.name,
      birth_date: input.birth_date ?? null,
      ...(input.color ? { color: input.color } : {}),
    })
    .select("id")
    .single();
  fail(error);
  return ok(`${input.name} är tillagd.`, data?.id);
}

export async function createPlace(
  userId: string,
  input: {
    name: string;
    lat: number;
    lng: number;
    kind: "jobb" | "jurist" | "hem" | "barn" | "annat";
    radius_m?: number | undefined;
    address?: string | undefined;
  },
) {
  const { PLACE_KINDS } = await import("@/lib/geo");
  const { data, error } = await supabaseAdmin
    .from("places")
    .insert({
      user_id: userId,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      kind: input.kind,
      radius_m: input.radius_m ?? 150,
      address: input.address ?? null,
      color: PLACE_KINDS.find((k) => k.value === input.kind)?.color ?? "#3b82f6",
    })
    .select("id")
    .single();
  fail(error);
  return ok(`Platsen "${input.name}" är sparad.`, data?.id);
}

export async function updatePlace(
  userId: string,
  input: {
    place_id: string;
    name?: string | undefined;
    kind?: "jobb" | "jurist" | "hem" | "barn" | "annat" | undefined;
    radius_m?: number | undefined;
  },
) {
  const patch: TablesUpdate<"places"> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.radius_m !== undefined) patch.radius_m = input.radius_m;

  if (Object.keys(patch).length === 0) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("places")
    .update(patch)
    .eq("id", input.place_id)
    .eq("user_id", userId);
  fail(error);

  if (input.name) {
    await supabaseAdmin
      .from("visits")
      .update({ label: input.name })
      .eq("user_id", userId)
      .eq("place_id", input.place_id);
  }
  return ok("Platsen är uppdaterad.");
}

export async function deletePlace(userId: string, placeId: string, deleteVisits = false) {
  if (deleteVisits) {
    await supabaseAdmin.from("visits").delete().eq("user_id", userId).eq("place_id", placeId);
  } else {
    await supabaseAdmin
      .from("visits")
      .update({ place_id: null })
      .eq("user_id", userId)
      .eq("place_id", placeId);
  }
  const { error } = await supabaseAdmin
    .from("places")
    .delete()
    .eq("id", placeId)
    .eq("user_id", userId);
  fail(error);
  return ok(
    deleteVisits ? "Platsen och dess besök är borttagna." : "Platsen är borttagen.",
  );
}

export async function labelVisit(
  userId: string,
  input: { visit_id: string; label: string; note?: string | undefined },
) {
  const { error } = await supabaseAdmin
    .from("visits")
    .update({ label: input.label, note: input.note ?? null })
    .eq("id", input.visit_id)
    .eq("user_id", userId);
  fail(error);
  return ok(`Besöket heter nu "${input.label}".`);
}

export async function deleteVisit(userId: string, visitId: string) {
  const { error } = await supabaseAdmin
    .from("visits")
    .delete()
    .eq("id", visitId)
    .eq("user_id", userId);
  fail(error);
  return ok("Posten i platsloggen är borttagen.");
}

export async function checkInAtPlace(userId: string, placeId: string) {
  const { data: place, error } = await supabaseAdmin
    .from("places")
    .select("*")
    .eq("id", placeId)
    .eq("user_id", userId)
    .maybeSingle();
  fail(error);
  if (!place) throw new Error("Platsen hittades inte.");

  const { recordPosition } = await import("@/lib/visit-tracking.server");
  await recordPosition(userId, { lat: place.lat, lng: place.lng, source: "manual" });
  return ok(`Incheckad på ${place.name}.`);
}

export async function endVisit(userId: string) {
  const { closeOpenVisit } = await import("@/lib/visit-tracking.server");
  const closed = await closeOpenVisit(userId);
  return ok(closed ? "Besöket är avslutat." : "Det fanns inget pågående besök.");
}

/** Markerar ett besök som resa och låter appen fylla i sträcka och färdsätt. */
export async function markTravel(userId: string, visitId: string) {
  const { markVisitAsTravel } = await import("@/lib/travel-classify.server");
  const result = await markVisitAsTravel(supabaseAdmin, userId, visitId);
  return ok(
    `Markerad som resa: ${result.label}, ${(result.distance_m / 1000)
      .toFixed(1)
      .replace(".", ",")} km, ${result.minutes} min.`,
    result.visitId,
  );
}

/** Slår ihop flera reseposter i följd till en resa. */
export async function mergeTravels(userId: string, visitIds: string[]) {
  const { mergeTravelVisits } = await import("@/lib/travel-classify.server");
  const result = await mergeTravelVisits(supabaseAdmin, userId, visitIds);
  return ok(
    `Slog ihop ${visitIds.length} poster till en resa på ${(result.distance_m / 1000)
      .toFixed(1)
      .replace(".", ",")} km.`,
    result.visitId,
  );
}

/** Sparar ett prefererat färdsätt för en rutt eller veckodag. */
export async function saveTravelPreference(
  userId: string,
  input: {
    kind: "rutt" | "veckodag";
    route_key?: string | undefined;
    weekday?: number | undefined;
    preferred_mode: "bil" | "kollektivt" | "gang_cykel" | "okant";
  },
) {
  const routeKey = input.route_key ?? null;
  const weekday = input.weekday ?? null;
  let del = supabaseAdmin
    .from("travel_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("kind", input.kind);
  del = routeKey ? del.eq("route_key", routeKey) : del.is("route_key", null);
  del = weekday != null ? del.eq("weekday", weekday) : del.is("weekday", null);
  await del;
  const { error } = await supabaseAdmin.from("travel_preferences").insert({
    user_id: userId,
    kind: input.kind,
    route_key: routeKey,
    weekday,
    preferred_mode: input.preferred_mode,
  });
  fail(error);
  return ok("Preferensen är sparad.");
}

/** Reseplan för kommande dagar: färdsätt, restid och marginaler. */
export async function planWeekTravel(userId: string, days = 7) {
  const { buildTravelPlan, summarizePlan } = await import("@/lib/travel-plan");
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const until = new Date(Date.now() + days * 86400000).toISOString();

  const [events, places, visits, prefs] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", until)
      .order("starts_at"),
    supabaseAdmin.from("places").select("*").eq("user_id", userId),
    supabaseAdmin.from("visits").select("*").eq("user_id", userId).gte("arrived_at", since),
    supabaseAdmin.from("travel_preferences").select("*").eq("user_id", userId),
  ]);
  fail(events.error);
  fail(places.error);
  fail(visits.error);
  fail(prefs.error);

  const plan = buildTravelPlan({
    events: events.data ?? [],
    places: places.data ?? [],
    visits: visits.data ?? [],
    preferences: prefs.data ?? [],
    days,
  });

  if (!plan.length) {
    return {
      ok: true as const,
      message: "Hittade inga kommande aktiviteter med en plats jag känner igen.",
      plan: "",
    };
  }

  return {
    ok: true as const,
    message: `Reseplan för ${plan.length} kommande resor.`,
    plan: summarizePlan(plan),
  };
}

/** Analysunderlag för resmönster per färdsätt. */
export async function analyzeTravelTrend(userId: string, days = 180) {
  const { buildTrendStats, summarizeTrend } = await import("@/lib/travel-trend");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [visits, places, prefs] = await Promise.all([
    supabaseAdmin.from("visits").select("*").eq("user_id", userId).gte("arrived_at", since),
    supabaseAdmin.from("places").select("*").eq("user_id", userId),
    supabaseAdmin.from("travel_preferences").select("*").eq("user_id", userId),
  ]);
  fail(visits.error);
  fail(places.error);
  fail(prefs.error);

  const stats = buildTrendStats(visits.data ?? [], places.data ?? []);
  const summary = summarizeTrend(stats, prefs.data ?? []);

  if (!summary.trim()) {
    return { ok: true as const, message: "För få loggade resor för en trendanalys.", summary: "" };
  }

  return {
    ok: true as const,
    message: `Trendunderlag för ${stats.length} färdsätt de senaste ${days} dagarna.`,
    summary,
  };
}

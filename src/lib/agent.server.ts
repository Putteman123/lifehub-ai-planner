import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { parseLocal } from "@/lib/tz";

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

/** Tider utan tidszon tolkas som svensk lokaltid, inte serverns UTC. */
function iso(value: string) {
  const d = parseLocal(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Ogiltigt datum: ${value}`);
  return d.toISOString();
}

export type EventInput = {
  title: string;
  starts_at: string;
  ends_at: string;
  category: string;
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

/** Lägger till varor i den aktiva inköpslistan (skapar en om det behövs). */
export async function addShoppingItems(userId: string, input: { items: string[] }) {
  const names = input.items.map((n) => n.trim()).filter(Boolean);
  if (!names.length) return ok("Inga varor att lägga till.");

  const existingList = await supabaseAdmin
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "aktiv")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(existingList.error);

  let listId = existingList.data?.id;
  if (!listId) {
    const created = await supabaseAdmin
      .from("shopping_lists")
      .insert({ user_id: userId, title: "Inköpslista" })
      .select("id")
      .single();
    fail(created.error);
    listId = created.data!.id;
  }

  const current = await supabaseAdmin
    .from("shopping_items")
    .select("name, sort_order")
    .eq("list_id", listId);
  fail(current.error);

  const taken = new Set((current.data ?? []).map((row) => row.name.trim().toLowerCase()));
  let order = Math.max(0, ...(current.data ?? []).map((row) => row.sort_order));
  const fresh = names.filter((name) => {
    const key = name.toLowerCase();
    if (taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  if (!fresh.length) return ok("Varorna fanns redan i listan.");

  const inserted = await supabaseAdmin.from("shopping_items").insert(
    fresh.map((name) => ({
      user_id: userId,
      list_id: listId!,
      name,
      source: "manuell" as const,
      sort_order: ++order,
    })),
  );
  fail(inserted.error);

  for (const name of fresh) {
    const key = name.toLowerCase();
    const existing = await supabaseAdmin
      .from("pantry_items")
      .select("id, times_added")
      .eq("user_id", userId)
      .eq("name_key", key)
      .maybeSingle();
    if (existing.data) {
      await supabaseAdmin
        .from("pantry_items")
        .update({ times_added: existing.data.times_added + 1, last_added_at: new Date().toISOString() })
        .eq("id", existing.data.id);
    } else {
      await supabaseAdmin
        .from("pantry_items")
        .insert({ user_id: userId, name, name_key: key, source: "manuell" });
    }
  }

  return ok(`La till ${fresh.length} varor i inköpslistan.`);
}

/* ------------------------------------------------------------------ *
 * Utökade rättigheter: rätta data, ekonomi, kassaskåp och juristappen.
 * ------------------------------------------------------------------ */

/** Rättar en uppgift i Att göra. */
export async function updateTodo(
  userId: string,
  input: { todo_id: string; title?: string | undefined; due_date?: string | null | undefined; notes?: string | undefined },
) {
  const patch: TablesUpdate<"todos"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.due_date !== undefined) patch.due_date = input.due_date ? iso(input.due_date) : null;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (!Object.keys(patch).length) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("todos")
    .update(patch)
    .eq("id", input.todo_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Uppgiften är rättad.");
}

/** Rättar eller bockar av en påminnelse. */
export async function updateReminder(
  userId: string,
  input: { reminder_id: string; title?: string | undefined; remind_at?: string | undefined; is_done?: boolean | undefined },
) {
  const patch: TablesUpdate<"reminders"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.remind_at !== undefined) patch.remind_at = iso(input.remind_at);
  if (input.is_done !== undefined) patch.is_done = input.is_done;
  if (!Object.keys(patch).length) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("reminders")
    .update(patch)
    .eq("id", input.reminder_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Påminnelsen är uppdaterad.");
}

/** Tar bort en påminnelse. */
export async function deleteReminder(userId: string, reminderId: string) {
  const { error } = await supabaseAdmin
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("user_id", userId);
  fail(error);
  return ok("Påminnelsen är borttagen.");
}

/** Rättar ett juristärende. */
export async function updateCase(
  userId: string,
  input: { case_id: string; title?: string | undefined; client_name?: string | undefined; status?: string | undefined; description?: string | undefined },
) {
  const patch: TablesUpdate<"legal_cases"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.client_name !== undefined) patch.client_name = input.client_name;
  if (input.status !== undefined) patch.status = input.status;
  if (input.description !== undefined) patch.description = input.description;
  if (!Object.keys(patch).length) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("legal_cases")
    .update(patch)
    .eq("id", input.case_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Ärendet är uppdaterat.");
}

/** Rättar eller bockar av en juristuppgift. */
export async function updateCaseTask(
  userId: string,
  input: { task_id: string; title?: string | undefined; due_date?: string | undefined; is_done?: boolean | undefined },
) {
  const patch: TablesUpdate<"case_tasks"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.due_date !== undefined) patch.due_date = iso(input.due_date);
  if (input.is_done !== undefined) patch.is_done = input.is_done;
  if (!Object.keys(patch).length) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("case_tasks")
    .update(patch)
    .eq("id", input.task_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Juristuppgiften är uppdaterad.");
}

/** Rättar ett besök eller en resa i platsloggen (tider, sträcka, färdsätt). */
export async function updateVisit(
  userId: string,
  input: {
    visit_id: string;
    label?: string | undefined;
    arrived_at?: string | undefined;
    left_at?: string | undefined;
    distance_km?: number | undefined;
    travel_mode?: "bil" | "kollektivt" | "gang_cykel" | "okant" | undefined;
    entry_kind?: "besok" | "resa" | undefined;
    note?: string | undefined;
  },
) {
  const patch: TablesUpdate<"visits"> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.arrived_at !== undefined) patch.arrived_at = iso(input.arrived_at);
  if (input.left_at !== undefined) patch.left_at = iso(input.left_at);
  if (input.distance_km !== undefined) {
    patch.distance_m = Math.round(input.distance_km * 1000);
    patch.distance_verified = true;
  }
  if (input.travel_mode !== undefined) patch.travel_mode = input.travel_mode;
  if (input.entry_kind !== undefined) patch.entry_kind = input.entry_kind;
  if (input.note !== undefined) patch.note = input.note;
  if (!Object.keys(patch).length) throw new Error("Inget att ändra.");

  const { error } = await supabaseAdmin
    .from("visits")
    .update(patch)
    .eq("id", input.visit_id)
    .eq("user_id", userId);
  fail(error);
  return ok("Posten i platsloggen är rättad.");
}

/** Kartlägger en dag utifrån positionshistoriken. */
export async function analyzeDayForUser(userId: string, day: string) {
  const { analyzeDay } = await import("@/lib/day-mapping.server");
  const result = await analyzeDay(userId, day);
  return { ok: result.ok, message: result.message };
}

/* --------------------------- Ekonomi --------------------------- */

/** Registrerar en utgift och drar beloppet från kontot. */
export async function addSpend(
  userId: string,
  input: { amount: number; note?: string | undefined; category?: string | undefined; account_name?: string | undefined; spent_at?: string | undefined },
) {
  let accountId: string | null = null;
  if (input.account_name) {
    const { data } = await supabaseAdmin
      .from("finance_accounts")
      .select("id, name, balance")
      .eq("user_id", userId);
    const match = (data ?? []).find(
      (a) => a.name.toLowerCase() === input.account_name!.toLowerCase(),
    );
    if (!match) throw new Error(`Hittade inget konto som heter "${input.account_name}".`);
    accountId = match.id;
    await supabaseAdmin
      .from("finance_accounts")
      .update({ balance: Number(match.balance) - input.amount })
      .eq("id", match.id);
  }

  const { error } = await supabaseAdmin.from("spend_entries").insert({
    user_id: userId,
    amount: input.amount,
    note: input.note ?? null,
    category: input.category ?? null,
    account_id: accountId,
    spent_at: input.spent_at ? iso(input.spent_at) : new Date().toISOString(),
  });
  fail(error);
  return ok(`Utgift på ${input.amount} kr registrerad.`);
}

/** Sätter saldot på ett konto. */
export async function setAccountBalance(
  userId: string,
  input: { account_name: string; balance: number },
) {
  const { data } = await supabaseAdmin
    .from("finance_accounts")
    .select("id, name")
    .eq("user_id", userId);
  const match = (data ?? []).find(
    (a) => a.name.toLowerCase() === input.account_name.toLowerCase(),
  );
  if (!match) throw new Error(`Hittade inget konto som heter "${input.account_name}".`);

  const { error } = await supabaseAdmin
    .from("finance_accounts")
    .update({ balance: input.balance })
    .eq("id", match.id);
  fail(error);
  return ok(`${match.name} står nu på ${input.balance} kr.`);
}

/** Lägger till eller ändrar en fast utgift. */
export async function saveFixedExpense(
  userId: string,
  input: { name: string; amount: number; due_day: number; category?: string | undefined },
) {
  const { data: existing } = await supabaseAdmin
    .from("fixed_expenses")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", input.name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("fixed_expenses")
      .update({ amount: input.amount, due_day: input.due_day, category: input.category ?? null })
      .eq("id", existing.id);
    fail(error);
    return ok(`Den fasta utgiften "${input.name}" är uppdaterad.`);
  }

  const { error } = await supabaseAdmin.from("fixed_expenses").insert({
    user_id: userId,
    name: input.name,
    amount: input.amount,
    due_day: input.due_day,
    category: input.category ?? null,
  });
  fail(error);
  return ok(`Fast utgift "${input.name}" tillagd.`);
}

/** Sammanfattning av ekonomin: saldon, kommande inbetalning och dagsbudget. */
export async function financeOverview(userId: string) {
  const [accounts, incomes, fixed, spends] = await Promise.all([
    supabaseAdmin.from("finance_accounts").select("*").eq("user_id", userId),
    supabaseAdmin.from("finance_incomes").select("*").eq("user_id", userId),
    supabaseAdmin.from("fixed_expenses").select("*").eq("user_id", userId).eq("is_active", true),
    supabaseAdmin
      .from("spend_entries")
      .select("amount, spent_at, note, category")
      .eq("user_id", userId)
      .gte("spent_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const total = (accounts.data ?? []).reduce((sum, a) => sum + Number(a.balance), 0);
  const next = (incomes.data ?? [])
    .filter((i) => !i.is_received && new Date(i.expected_on).getTime() >= Date.now() - 86400000)
    .sort((a, b) => a.expected_on.localeCompare(b.expected_on))[0];
  const days = next
    ? Math.max(1, Math.ceil((new Date(next.expected_on).getTime() - Date.now()) / 86400000))
    : 30;

  return {
    ok: true as const,
    message: "Ekonomiöversikt.",
    summary: [
      `Konton: ${(accounts.data ?? []).map((a) => `${a.name} ${Math.round(Number(a.balance))} kr`).join(", ") || "inga"}`,
      `Totalt saldo: ${Math.round(total)} kr`,
      next
        ? `Nästa inbetalning: ${next.label} ${Math.round(Number(next.amount))} kr den ${next.expected_on} (om ${days} dagar)`
        : "Ingen kommande inbetalning registrerad",
      `Dagsbudget: ${Math.round(total / days)} kr/dag`,
      `Fasta utgifter: ${(fixed.data ?? []).map((f) => `${f.name} ${Math.round(Number(f.amount))} kr (${f.due_day}:e)`).join(", ") || "inga"}`,
      `Utgifter senaste 30 dagarna: ${Math.round((spends.data ?? []).reduce((s, e) => s + Number(e.amount), 0))} kr`,
    ].join("\n"),
  };
}

/* --------------------------- Kassaskåp --------------------------- */

/** Söker i kassaskåpet och returnerar hemligheterna i klartext. */
export async function vaultLookup(userId: string, query: string) {
  const term = query.trim();
  let request = supabaseAdmin
    .from("vault_items")
    .select("id, kind, title, username, secret, url, notes")
    .eq("user_id", userId)
    .order("title");
  if (term) {
    request = request.or(`title.ilike.%${term}%,username.ilike.%${term}%,url.ilike.%${term}%`);
  }

  const { data, error } = await request.limit(10);
  fail(error);
  if (!data?.length) return { ok: true as const, message: "Hittade inget i kassaskåpet.", items: [] };

  return {
    ok: true as const,
    message: `${data.length} poster i kassaskåpet.`,
    items: data,
  };
}

/** Sparar eller uppdaterar en post i kassaskåpet. */
export async function vaultSave(
  userId: string,
  input: {
    title: string;
    secret: string;
    kind?: "losenord" | "pinkod" | "kod" | "anteckning" | undefined;
    username?: string | undefined;
    url?: string | undefined;
    notes?: string | undefined;
  },
) {
  const { data: existing } = await supabaseAdmin
    .from("vault_items")
    .select("id")
    .eq("user_id", userId)
    .ilike("title", input.title)
    .maybeSingle();

  const values = {
    user_id: userId,
    title: input.title,
    secret: input.secret,
    kind: input.kind ?? ("losenord" as const),
    username: input.username ?? null,
    url: input.url ?? null,
    notes: input.notes ?? null,
  };

  if (existing) {
    const { error } = await supabaseAdmin.from("vault_items").update(values).eq("id", existing.id);
    fail(error);
    return ok(`"${input.title}" är uppdaterad i kassaskåpet.`);
  }

  const { data, error } = await supabaseAdmin
    .from("vault_items")
    .insert(values)
    .select("id")
    .single();
  fail(error);
  return ok(`"${input.title}" är sparad i kassaskåpet.`, data?.id);
}

/** Tar bort en post i kassaskåpet. */
export async function vaultDelete(userId: string, itemId: string) {
  const { error } = await supabaseAdmin
    .from("vault_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);
  fail(error);
  return ok("Posten är borttagen ur kassaskåpet.");
}

/* --------------------------- Andreas profil --------------------------- */

/** Sparar hur Andrea ska bemöta användaren. */
export async function saveAndreaProfile(
  userId: string,
  input: { call_name?: string | undefined; tone?: string | undefined; directness?: number | undefined; focus?: string | undefined; notes?: string | undefined },
) {
  const values: Record<string, unknown> = { user_id: userId };
  if (input.call_name !== undefined) values["call_name"] = input.call_name;
  if (input.tone !== undefined) values["tone"] = input.tone;
  if (input.directness !== undefined) values["directness"] = input.directness;
  if (input.focus !== undefined) values["focus"] = input.focus;
  if (input.notes !== undefined) values["notes"] = input.notes;

  const { error } = await supabaseAdmin
    .from("andrea_profile")
    .upsert(values as never, { onConflict: "user_id" });
  fail(error);
  return ok("Jag har uppdaterat hur jag ska bemöta dig.");
}

/* --------------------------- Juristappen (Apples) --------------------------- */

/** Söker ärenden i juristappen (endast läsning). */
export async function applesCases(query: string) {
  const { searchCases } = await import("@/lib/apples.server");
  return searchCases(query);
}

/** Hämtar ett ärende med dokument ur juristappen. */
export async function applesCase(caseId: string) {
  const { getCase } = await import("@/lib/apples.server");
  return getCase(caseId);
}

/** Söker klienter i juristappen. */
export async function applesClients(query: string) {
  const { searchClients } = await import("@/lib/apples.server");
  return searchClients(query);
}

/** Söker dokument i juristappen. */
export async function applesDocuments(query: string) {
  const { searchDocuments } = await import("@/lib/apples.server");
  return searchDocuments(query);
}

/** Kommande deadlines och förhandlingar i juristappen. */
export async function applesDeadlines(days = 30) {
  const { upcomingDeadlines } = await import("@/lib/apples.server");
  return upcomingDeadlines(days);
}

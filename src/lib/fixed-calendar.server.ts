/** Håller kalenderhändelser för fasta utgifter och prenumerationer i synk. Endast server. */
import type { SupabaseClient } from "@supabase/supabase-js";

import { duePeriods, periodKey } from "@/lib/fixed-expenses";

type Client = SupabaseClient<any, any, any>;

const CATEGORY = "ekonomi";
const MONTHS_AHEAD = 12;

export type FixedForCalendar = {
  id: string;
  name: string;
  amount: number | string;
  due_day: number;
  is_active: boolean;
  is_subscription?: boolean | null;
  interval_months?: number | null;
  anchor_month?: number | null;
  sync_calendar?: boolean | null;
  created_at?: string | null;
};

/** Ser till att kategorin "Ekonomi" finns bland användarens egna kategorier. */
async function ensureCategory(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("event_categories")
    .select("id, color_token")
    .eq("user_id", userId)
    .eq("value", CATEGORY)
    .maybeSingle();
  if (data) {
    if (data.color_token !== "cat-ekonomi") {
      await supabase
        .from("event_categories")
        .update({ color_token: "cat-ekonomi" })
        .eq("id", data.id);
    }
    return;
  }
  await supabase.from("event_categories").insert({
    user_id: userId,
    value: CATEGORY,
    label: "Ekonomi",
    color_token: "cat-ekonomi",
    sort_order: 95,
  });
}

function kr(amount: number) {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )} kr`;
}

function startOfPeriod(period: string, day: number) {
  const [y, m] = period.split("-").map(Number);
  const safeDay = Math.min(Math.max(day || 1, 1), 28);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, safeDay, 6, 0, 0));
}

/**
 * Skapar/uppdaterar heldagshändelser 12 månader framåt för en fast utgift
 * och tar bort de som inte längre gäller. Idempotent via external_id.
 */
export async function syncFixedEvents(
  supabase: Client,
  userId: string,
  expense: FixedForCalendar,
  paidPeriods: string[] = [],
) {
  const prefix = `fixed:${expense.id}:`;
  const { data: existing } = await supabase
    .from("events")
    .select("id, external_id")
    .eq("user_id", userId)
    .like("external_id", `${prefix}%`);

  const byExternal = new Map<string, string>(
    (existing ?? []).map((row: { id: string; external_id: string | null }) => [
      row.external_id ?? "",
      row.id,
    ]),
  );

  const wanted =
    expense.is_active && expense.sync_calendar !== false
      ? duePeriods(expense, periodKey(), MONTHS_AHEAD)
      : [];

  if (wanted.length) await ensureCategory(supabase, userId);

  const amount = Number(expense.amount);
  const paid = new Set(paidPeriods);
  const keep = new Set<string>();

  for (const period of wanted) {
    const externalId = `${prefix}${period}`;
    keep.add(externalId);
    const start = startOfPeriod(period, expense.due_day);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const title = `${paid.has(period) ? "✓ " : ""}${expense.name} ${kr(amount)}`;
    const payload = {
      user_id: userId,
      title,
      category: CATEGORY,
      all_day: true,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      external_id: externalId,
      description: expense.is_subscription
        ? "Prenumeration – automatiskt skapad av Pengar i LifeHub."
        : "Fast utgift – automatiskt skapad av Pengar i LifeHub.",
    };

    const id = byExternal.get(externalId);
    if (id) await supabase.from("events").update(payload).eq("id", id);
    else await supabase.from("events").insert(payload);
  }

  const stale = (existing ?? [])
    .filter((row: { external_id: string | null }) => !keep.has(row.external_id ?? ""))
    .map((row: { id: string }) => row.id);
  if (stale.length) {
    await supabase.from("reminders").delete().in("event_id", stale);
    await supabase.from("events").delete().in("id", stale);
  }

  return { created: wanted.length, removed: stale.length };
}

/** Tar bort alla kalenderhändelser för en borttagen fast utgift. */
export async function removeFixedEvents(supabase: Client, userId: string, expenseId: string) {
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .like("external_id", `fixed:${expenseId}:%`);
  const ids = (existing ?? []).map((row: { id: string }) => row.id);
  if (!ids.length) return;
  await supabase.from("reminders").delete().in("event_id", ids);
  await supabase.from("events").delete().in("id", ids);
}

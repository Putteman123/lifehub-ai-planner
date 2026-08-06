/** Håller kalenderhändelser för IPTV-utgångar i synk. Endast server. */
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, any, any>;

const CATEGORY = "iptv";

/** Ser till att kategorin "IPTV" finns bland användarens egna kategorier. */
async function ensureCategory(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("event_categories")
    .select("id, color_token")
    .eq("user_id", userId)
    .eq("value", CATEGORY)
    .maybeSingle();
  if (data) {
    if (data.color_token !== "cat-iptv") {
      await supabase.from("event_categories").update({ color_token: "cat-iptv" }).eq("id", data.id);
    }
    return;
  }
  await supabase.from("event_categories").insert({
    user_id: userId,
    value: CATEGORY,
    label: "IPTV",
    color_token: "cat-iptv",
    sort_order: 90,
  });
}

/** Skapar/uppdaterar heldagshändelsen och påminnelsen för en linjes utgångsdatum. */
export async function syncExpiryEvent(
  supabase: Client,
  userId: string,
  line: { id: string; customer_name: string; expires_at: string | null },
) {
  const externalId = `iptv:${line.id}`;
  if (!line.expires_at) {
    await removeExpiryEvent(supabase, userId, line.id);
    return;
  }

  await ensureCategory(supabase, userId);

  const day = new Date(line.expires_at);
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 6, 0, 0),
  );
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const title = `IPTV går ut: ${line.customer_name}`;

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", externalId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    title,
    category: CATEGORY,
    all_day: true,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    external_id: externalId,
    description: "Automatiskt skapad av IPTV-panelen i LifeHub.",
  };

  let eventId = existing?.id as string | undefined;
  if (eventId) {
    await supabase.from("events").update(payload).eq("id", eventId);
  } else {
    const { data: inserted } = await supabase.from("events").insert(payload).select("id").single();
    eventId = inserted?.id as string | undefined;
  }

  // Påminnelse 7 dagar innan utgång.
  const remindAt = new Date(start.getTime() - 7 * 86400000).toISOString();
  const { data: reminder } = await supabase
    .from("reminders")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId ?? "")
    .maybeSingle();

  if (eventId) {
    if (reminder) {
      await supabase
        .from("reminders")
        .update({ title: `${title} (om 7 dagar)`, remind_at: remindAt })
        .eq("id", reminder.id);
    } else {
      await supabase.from("reminders").insert({
        user_id: userId,
        event_id: eventId,
        title: `${title} (om 7 dagar)`,
        remind_at: remindAt,
      });
    }
  }
}

/** Tar bort kalenderhändelse och påminnelse för en borttagen linje. */
export async function removeExpiryEvent(supabase: Client, userId: string, lineId: string) {
  const externalId = `iptv:${lineId}`;
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!existing) return;
  await supabase.from("reminders").delete().eq("event_id", existing.id);
  await supabase.from("events").delete().eq("id", existing.id);
}

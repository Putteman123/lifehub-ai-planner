import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendarId: string }) => {
    if (!input?.calendarId) throw new Error("calendarId saknas");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { parseIcs, normalizeIcsUrl } = await import("./ics.server");
    const { supabase, userId } = context;

    const { data: calendar, error: calErr } = await supabase
      .from("calendars")
      .select("*")
      .eq("id", data.calendarId)
      .maybeSingle();

    if (calErr) throw new Error(calErr.message);
    if (!calendar) throw new Error("Kalendern hittades inte.");

    const isGoogle = calendar.source === "google" && Boolean(calendar.external_id);

    let parsed: Array<{
      uid: string;
      title: string;
      description: string | null;
      location: string | null;
      starts_at: string;
      ends_at: string;
      all_day: boolean;
    }> = [];

    if (isGoogle) {
      const { fetchGoogleEvents } = await import("./google.server");
      const now = Date.now();
      parsed = await fetchGoogleEvents(
        calendar.external_id as string,
        new Date(now - 60 * 86400000).toISOString(),
        new Date(now + 365 * 86400000).toISOString(),
      );
    } else {
      if (!calendar.ics_url) {
        throw new Error("Den här kalendern saknar en ICS-länk. Lägg till länken och försök igen.");
      }

      const url = normalizeIcsUrl(calendar.ics_url);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
            "User-Agent": "LifeHubAI/1.0",
          },
          redirect: "follow",
        });
      } catch {
        throw new Error("Kunde inte nå kalenderlänken. Kontrollera adressen och att den är publik.");
      }

      if (!res.ok) {
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Kalenderlänken kräver inloggning. Använd en publik/hemlig ICS-adress."
            : `Kalendern svarade med fel (${res.status}).`,
        );
      }

      const text = await res.text();
      if (!text.includes("BEGIN:VCALENDAR")) {
        throw new Error(
          "Länken returnerade ingen ICS-kalender. Kontrollera att adressen slutar på .ics.",
        );
      }
      parsed = parseIcs(text);
    }

    if (parsed.length === 0) {
      await supabase
        .from("calendars")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", calendar.id);
      return { imported: 0 };
    }


    const category = (
      ["jobb", "ledig", "jurist", "barn", "privat", "viktigt"] as const
    ).includes(calendar.color as never)
      ? (calendar.color as "jobb" | "ledig" | "jurist" | "barn" | "privat" | "viktigt")
      : "privat";

    // Ersätt tidigare importerade händelser för den här kalendern.
    const { error: delErr } = await supabase
      .from("events")
      .delete()
      .eq("calendar_id", calendar.id)
      .not("external_id", "is", null);
    if (delErr) throw new Error(delErr.message);

    const rows = parsed.map((e) => ({
      user_id: userId,
      calendar_id: calendar.id,
      title: e.title,
      description: e.description,
      location: e.location,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      all_day: e.all_day,
      category,
      external_id: e.uid,
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("events").insert(rows.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("calendars")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", calendar.id);

    return { imported: rows.length };
  });

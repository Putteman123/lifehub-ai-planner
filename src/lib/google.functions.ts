import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Vilka Google-tjänster som är kopplade till appen. */
export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { GOOGLE_CONNECTORS, hasGoogle } = await import("./google.server");
    return (Object.keys(GOOGLE_CONNECTORS) as Array<keyof typeof GOOGLE_CONNECTORS>).map(
      (service) => ({
        service,
        label: GOOGLE_CONNECTORS[service].label,
        connected: hasGoogle(service),
      }),
    );
  });

/** Alla kalendrar i det inloggade Google-kontot. */
export const listGoogleCalendarsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listGoogleCalendars } = await import("./google.server");
    return listGoogleCalendars();
  });

/** Koppla en Google-kalender till LifeHub och synka den direkt. */
export const connectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { externalId: string; name: string; color?: string }) => {
    if (!input?.externalId) throw new Error("Kalender-id saknas.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("calendars")
      .select("id")
      .eq("external_id", data.externalId)
      .maybeSingle();

    if (existing) return { calendarId: existing.id, created: false };

    const { data: row, error } = await supabase
      .from("calendars")
      .insert({
        user_id: userId,
        name: data.name,
        source: "google",
        color: data.color ?? "privat",
        external_id: data.externalId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { calendarId: row.id, created: true };
  });

/** Hämta olästa mejl / sökresultat från Gmail. */
export const getInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { query?: string; max?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { gmailList, hasGoogle, mailQueryWithRules } = await import("./google.server");
    if (!hasGoogle("mail")) return { connected: false as const, mails: [] };
    try {
      const query = await mailQueryWithRules(data.query ?? "is:unread in:inbox");
      const mails = await gmailList(query, data.max ?? 6);
      return { connected: true as const, mails };
    } catch (error) {
      return {
        connected: true as const,
        mails: [],
        error: error instanceof Error ? error.message : "Kunde inte hämta mejl.",
      };
    }
  });

export const sendMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; subject: string; body: string }) => {
    if (!input?.to || !input.subject) throw new Error("Mottagare och ämne krävs.");
    return input;
  })
  .handler(async ({ data }) => {
    const { gmailSend } = await import("./google.server");
    return gmailSend(data.to, data.subject, data.body);
  });

/**
 * Skriv en LifeHub-händelse till den riktiga Google-kalendern.
 * Skapar händelsen första gången och uppdaterar den vid senare ändringar.
 */
export const syncEventToGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => {
    if (!input?.eventId) throw new Error("Händelse-id saknas.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { createGoogleEvent, updateGoogleEvent, hasGoogle } = await import("./google.server");
    if (!hasGoogle("calendar")) return { pushed: false as const, reason: "not_connected" };

    const { data: event, error } = await supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location, description, external_id, calendar_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!event?.calendar_id) return { pushed: false as const, reason: "no_calendar" };

    const { data: calendar } = await supabase
      .from("calendars")
      .select("source, external_id")
      .eq("id", event.calendar_id)
      .maybeSingle();
    if (!calendar || calendar.source !== "google" || !calendar.external_id) {
      return { pushed: false as const, reason: "not_google" };
    }

    const payload = {
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      ...(event.location ? { location: event.location } : {}),
      ...(event.description ? { description: event.description } : {}),
    };

    const existingId = event.external_id?.startsWith("gcal:")
      ? event.external_id.slice("gcal:".length)
      : null;

    if (existingId) {
      await updateGoogleEvent(calendar.external_id, existingId, payload);
      return { pushed: true as const, googleEventId: existingId };
    }

    const created = await createGoogleEvent(calendar.external_id, payload);
    if (created.id) {
      await supabase.from("events").update({ external_id: `gcal:${created.id}` }).eq("id", event.id);
    }
    return { pushed: true as const, googleEventId: created.id };
  });

/** Ta bort en händelse ur Google-kalendern när den raderas i LifeHub. */
export const removeEventFromGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { calendarId: string; externalId: string }) => {
    if (!input?.calendarId || !input.externalId) throw new Error("Kalender och händelse krävs.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { deleteGoogleEvent, hasGoogle } = await import("./google.server");
    if (!hasGoogle("calendar") || !data.externalId.startsWith("gcal:")) {
      return { deleted: false as const };
    }
    const { data: calendar } = await context.supabase
      .from("calendars")
      .select("source, external_id")
      .eq("id", data.calendarId)
      .maybeSingle();
    if (!calendar || calendar.source !== "google" || !calendar.external_id) {
      return { deleted: false as const };
    }
    await deleteGoogleEvent(calendar.external_id, data.externalId.slice("gcal:".length));
    return { deleted: true as const };
  });

/** Sök filer i Google Drive. */
export const searchDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { query?: string; max?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { driveSearch, hasGoogle } = await import("./google.server");
    if (!hasGoogle("drive")) return { connected: false as const, files: [] };
    try {
      return { connected: true as const, files: await driveSearch(data.query ?? "", data.max ?? 8) };
    } catch (error) {
      return {
        connected: true as const,
        files: [],
        error: error instanceof Error ? error.message : "Kunde inte söka i Drive.",
      };
    }
  });

/** Skapa ett Google-dokument, t.ex. mötesanteckning för ett juristärende. */
export const createGoogleDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; text?: string }) => {
    if (!input?.title) throw new Error("Titel krävs.");
    return input;
  })
  .handler(async ({ data }) => {
    const { docsCreate } = await import("./google.server");
    return docsCreate(data.title, data.text ?? "");
  });

/** Exportera rader till ett nytt Google Sheet. */
export const exportToSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; rows: (string | number)[][] }) => {
    if (!input?.title || !Array.isArray(input.rows)) throw new Error("Titel och rader krävs.");
    return input;
  })
  .handler(async ({ data }) => {
    const { sheetsExport } = await import("./google.server");
    return sheetsExport(data.title, data.rows);
  });

/** Statusrapport för varje Google-tjänst med senaste synktid och eventuella fel. */
export const getGoogleHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { GOOGLE_CONNECTORS, checkGoogleService } = await import("./google.server");
    const services = Object.keys(GOOGLE_CONNECTORS) as Array<keyof typeof GOOGLE_CONNECTORS>;
    const health = await Promise.all(services.map((s) => checkGoogleService(s)));

    const { data: cals } = await context.supabase
      .from("calendars")
      .select("name, last_synced_at")
      .eq("source", "google")
      .order("last_synced_at", { ascending: false, nullsFirst: false });

    const lastCalendarSync = cals?.find((c) => c.last_synced_at)?.last_synced_at ?? null;

    return {
      checkedAt: new Date().toISOString(),
      lastCalendarSync,
      calendars: (cals ?? []).map((c) => ({ name: c.name, lastSyncedAt: c.last_synced_at })),
      services: health,
    };
  });

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
    const { gmailList, hasGoogle } = await import("./google.server");
    if (!hasGoogle("mail")) return { connected: false as const, mails: [] };
    try {
      const mails = await gmailList(data.query ?? "is:unread in:inbox", data.max ?? 6);
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

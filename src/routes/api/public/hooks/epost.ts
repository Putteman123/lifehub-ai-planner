import { createFileRoute } from "@tanstack/react-router";

/**
 * Schemalagda mejlutskick. Anropas av pg_cron med token i Authorization-headern:
 *  - mode "weekly"   → veckosammanfattning (söndag kväll)
 *  - mode "reminders" → dagliga påminnelser
 */
function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/epost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const envToken = process.env["EMAIL_CRON_TOKEN"] ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cron } = await supabaseAdmin
          .from("cron_settings")
          .select("token")
          .limit(1)
          .maybeSingle();
        const dbToken = (cron?.token as string | undefined) ?? "";

        const valid =
          (dbToken !== "" && timingSafeEqual(provided, dbToken)) ||
          (envToken !== "" && timingSafeEqual(provided, envToken));
        if (!valid) return new Response("Unauthorized", { status: 401 });

        let mode = "reminders";
        let force = false;
        try {
          const body = (await request.json()) as { mode?: string; force?: boolean };
          if (body?.mode === "weekly") mode = "weekly";
          force = body?.force === true;
        } catch {
          /* tom body = påminnelser */
        }

        // Cron körs i UTC; vi vaktar på svensk lokaltid så sommar-/vintertid inte förskjuter utskicket.
        const localHour = Number(
          new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Europe/Stockholm",
            hour: "2-digit",
            hour12: false,
          }).format(new Date()),
        );
        const wantedHour = mode === "weekly" ? 18 : 8;
        if (!force && localHour !== wantedHour) {
          return new Response(JSON.stringify({ ok: true, mode, skipped: "fel-timme" }), {
            headers: { "content-type": "application/json" },
          });
        }


        try {
          const { sendWeeklySummaryEmail, sendDailyRemindersEmail } = await import(
            "@/lib/scheduled-email.server"
          );
          const result =
            mode === "weekly" ? await sendWeeklySummaryEmail() : await sendDailyRemindersEmail();
          return new Response(JSON.stringify({ ok: true, mode, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "okänt fel";
          console.error("[epost-cron]", mode, message);
          return new Response(JSON.stringify({ ok: false, mode, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

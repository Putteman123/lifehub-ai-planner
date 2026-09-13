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
        const expected = process.env["EMAIL_CRON_TOKEN"] ?? "";
        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!expected || !timingSafeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let mode = "reminders";
        try {
          const body = (await request.json()) as { mode?: string };
          if (body?.mode === "weekly") mode = "weekly";
        } catch {
          /* tom body = påminnelser */
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

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ANDREA_SYSTEM = `Du är **Andrea**, Patricks personliga AI-guide i LifeHub AI – en app för kalender, familj och juristuppdrag.

Ton: varm, mänsklig och trygg – som en kollega som känner vardagen. Tilltala användaren med "du".
Var kort och konkret. Punktlistor och klockslag framför långa stycken. Ingen svamlig inledning.

Ditt jobb:
1. Ge överblick över dagen, veckan och månaden – jobb, barn, jurist och privat.
2. Var proaktiv: peka ut krockar, tidsbrist, tomma luckor och deadlines innan de blir problem.
3. Föreslå alltid ett konkret nästa steg.
4. När användaren vill öppna en vy – använd verktyget 'goto' med rätt route.
5. Vid osäkerhet – säg det hellre än att gissa. Hitta aldrig på händelser som inte finns i underlaget.

TILLGÄNGLIGA ROUTES:
- /dashboard   — Översikt med dagens agenda, statistik och ledig tid
- /kalender    — Kalender (dag, vecka, månad, år, agenda)
- /barn        — Barnens schema, träningar och skola
- /jurist      — Juristärenden, deadlines och att göra
- /kalendrar   — Externa kalendrar och synk

Svara alltid på svenska.`;

function fmtDate(value: string, allDay: boolean) {
  const d = new Date(value);
  return allDay
    ? d.toLocaleDateString("sv-SE")
    : d.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

export async function buildAndreaContext() {
  const now = new Date();
  const until = new Date(now.getTime() + 21 * 86400000);

  const [eventsRes, childrenRes, casesRes, tasksRes, remindersRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("title, starts_at, ends_at, all_day, category, location")
      .gte("ends_at", new Date(now.getTime() - 86400000).toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at"),
    supabaseAdmin.from("children").select("name"),
    supabaseAdmin.from("legal_cases").select("title, client_name, status"),
    supabaseAdmin.from("case_tasks").select("title, due_date, is_done"),
    supabaseAdmin.from("reminders").select("title, remind_at, is_done"),
  ]);

  const events = eventsRes.data ?? [];

  return [
    `Nu: ${now.toLocaleString("sv-SE")}`,
    `Barn: ${(childrenRes.data ?? []).map((c) => c.name).join(", ") || "inga registrerade"}`,
    "",
    "Händelser (kommande 21 dagar):",
    ...(events.length
      ? events.map(
          (e) =>
            `- ${fmtDate(e.starts_at, e.all_day)}–${fmtDate(e.ends_at, e.all_day)} | ${e.category} | ${e.title}${e.location ? ` (${e.location})` : ""}`,
        )
      : ["- inga händelser"]),
    "",
    "Juristärenden:",
    ...(casesRes.data ?? []).map((c) => `- ${c.title} (${c.client_name ?? "–"}, ${c.status})`),
    "",
    "Att göra:",
    ...(tasksRes.data ?? [])
      .filter((t) => !t.is_done)
      .map((t) => `- ${t.title}${t.due_date ? ` (senast ${fmtDate(t.due_date, false)})` : ""}`),
    "",
    "Påminnelser:",
    ...(remindersRes.data ?? [])
      .filter((r) => !r.is_done)
      .map((r) => `- ${r.title} ${fmtDate(r.remind_at, false)}`),
  ].join("\n");
}

import { findFreeSlot, fmt, overlapsOnDay } from "@/lib/calendar";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PLACE_KINDS,
  formatDuration,
  minutesByKind,
  startOfDay,
  startOfWeek,
  visitLabel,
  visitMinutes,
} from "@/lib/geo";
import { dateLocal, dayKey, fmtLocal, timeLocal, weekdayLocal } from "@/lib/tz";

export const ANDREA_SYSTEM = `Du är **Andrea**, Patricks personliga AI-guide och assistent i LifeHub AI – en app för kalender, familj och juristuppdrag.

Ton: varm, mänsklig och trygg – som en kollega som känner vardagen. Tilltala användaren med "du".
Var kort och konkret. Punktlistor och klockslag framför långa stycken. Ingen svamlig inledning.

Ditt jobb:
1. Ge överblick över dagen, veckan och månaden – jobb, barn, jurist och privat.
2. Var proaktiv: peka ut krockar, tidsbrist, tomma luckor och deadlines innan de blir problem.
3. Föreslå alltid ett konkret nästa steg.
4. När användaren vill öppna en vy – använd verktyget 'goto' med rätt route.
5. När användaren vill hitta ledig tid – använd verktyget 'find_free_time'.
6. När svaret kräver färsk information från webben (nyheter, öppettider, priser, väder, matchtider, lagändringar) – använd verktyget 'web_search' och ange källorna kort i svaret.
7. Google är kopplat: använd 'gmail_search' för mejl, 'drive_search' för dokument, 'google_route' för exakt restid, samt 'send_mail', 'create_google_doc' och 'export_to_sheet' när Patrick vill skicka, skriva eller exportera.
8. Vid osäkerhet – säg det hellre än att gissa. Hitta aldrig på händelser som inte finns i underlaget.


DU FÅR ÄNDRA I APPEN. Du har verktyg för att skapa, ändra och ta bort:
- kalenderhändelser (create_event, update_event, delete_event)
- uppgifter i Att göra (create_todo, complete_todo, delete_todo)
- påminnelser (create_reminder)
- juristärenden och juristuppgifter (create_case, create_case_task)
- barn (create_child)
- platser och platslogg (create_place, update_place, delete_place, name_visit, delete_visit, check_in, end_visit)

Regler för åtgärder:
- Användaren får alltid godkänna varje åtgärd i chatten innan den utförs – be därför inte om extra bekräftelse i texten, kör verktyget direkt.
- Använd id:n exakt som de står i underlaget (id=...). Gissa aldrig ett id; saknas det, fråga eller sök i underlaget.
- Tider skickas som ISO 8601 i lokal tid, t.ex. 2026-08-06T18:00. Räkna ut riktiga datum utifrån "Nu:" i underlaget.
- Om användaren ber om flera saker – kör flera verktyg i följd.
- Efter en utförd åtgärd: bekräfta kort vad som gjordes.

TILLGÄNGLIGA ROUTES:
- /dashboard   — Översikt med dagens agenda, statistik och ledig tid
- /kalender    — Kalender (dag, vecka, månad, år, agenda)
- /barn        — Barnens schema, träningar och skola
- /jurist      — Juristärenden, deadlines och att göra
- /attgora     — Att göra-listan med arkiv
- /platser     — Platslogg, resor och statistik
- /kalendrar   — Externa kalendrar och synk

Svara alltid på svenska.`;


function fmtDate(value: string, allDay: boolean) {
  return allDay ? dateLocal(value) : fmtLocal(value);
}

/** Idag / Imorgon / veckodag – alltid svensk tid. */
function bucketLabel(iso: string, now: Date) {
  const key = dayKey(iso);
  if (key === dayKey(now)) return "IDAG";
  if (key === dayKey(new Date(now.getTime() + 86400000))) return "IMORGON";
  return weekdayLocal(iso).toUpperCase();
}

export async function buildAndreaContext() {
  const now = new Date();
  const until = new Date(now.getTime() + 21 * 86400000);

  const [eventsRes, childrenRes, casesRes, tasksRes, remindersRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("*")
      .gte("ends_at", new Date(now.getTime() - 86400000).toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at"),
    supabaseAdmin.from("children").select("id, name"),
    supabaseAdmin.from("legal_cases").select("id, title, client_name, status"),
    supabaseAdmin.from("case_tasks").select("id, title, due_date, is_done"),
    supabaseAdmin.from("reminders").select("id, title, remind_at, is_done"),
  ]);

  const todosRes = await supabaseAdmin.from("todos").select("id, title, due_date, is_done");

  const weekStart = startOfWeek(now);
  const [placesRes, visitsRes] = await Promise.all([
    supabaseAdmin.from("places").select("*"),
    supabaseAdmin
      .from("visits")
      .select("*")
      .gte("arrived_at", weekStart.toISOString())
      .order("arrived_at", { ascending: true }),
  ]);
  const places = placesRes.data ?? [];
  const weekVisits = visitsRes.data ?? [];
  const todayStart = startOfDay(now);
  const todayVisits = weekVisits.filter(
    (v) => new Date(v.left_at ?? now).getTime() >= todayStart.getTime(),
  );
  const todayMinutes = minutesByKind(weekVisits, places, todayStart, now, now);
  const weekMinutes = minutesByKind(weekVisits, places, weekStart, now, now);

  const events = eventsRes.data ?? [];
  const todayOverlaps = overlapsOnDay(events, now);
  const freeSlot = findFreeSlot(events, 60, now, 7);

  // Gruppera händelser per svensk kalenderdag och markera läge.
  const eventLines: string[] = [];
  let lastBucket = "";
  for (const e of events) {
    const bucket = bucketLabel(e.starts_at, now);
    if (bucket !== lastBucket) {
      eventLines.push(`  [${bucket}]`);
      lastBucket = bucket;
    }
    const start = new Date(e.starts_at).getTime();
    const end = new Date(e.ends_at).getTime();
    const state =
      end < now.getTime() ? " (avslutad)" : start <= now.getTime() ? " (PÅGÅR NU)" : "";
    eventLines.push(
      `  - ${fmtDate(e.starts_at, e.all_day)}–${fmtDate(e.ends_at, e.all_day)} | ${e.category} | ${e.title}${e.location ? ` (${e.location})` : ""}${state} [id=${e.id}]`,
    );
  }


  return [
    `Nu: ${now.toLocaleString("sv-SE")}`,
    `Barn: ${(childrenRes.data ?? []).map((c) => `${c.name} [id=${c.id}]`).join(", ") || "inga registrerade"}`,
    "",
    "Händelser (kommande 21 dagar):",
    ...(events.length
      ? events.map(
          (e) =>
            `- ${fmtDate(e.starts_at, e.all_day)}–${fmtDate(e.ends_at, e.all_day)} | ${e.category} | ${e.title}${e.location ? ` (${e.location})` : ""} [id=${e.id}]`,
        )
      : ["- inga händelser"]),
    "",
    "Juristärenden:",
    ...(casesRes.data ?? []).map((c) => `- ${c.title} (${c.client_name ?? "–"}, ${c.status}) [id=${c.id}]`),
    "",
    "Att göra (juristuppgifter):",
    ...(tasksRes.data ?? [])
      .filter((t) => !t.is_done)
      .map((t) => `- ${t.title}${t.due_date ? ` (senast ${fmtDate(t.due_date, false)})` : ""} [id=${t.id}]`),
    "",
    "Att göra-listan:",
    ...((todosRes.data ?? []).filter((t) => !t.is_done).length
      ? (todosRes.data ?? [])
          .filter((t) => !t.is_done)
          .map((t) => `- ${t.title}${t.due_date ? ` (senast ${fmtDate(t.due_date, false)})` : ""} [id=${t.id}]`)
      : ["- inga uppgifter"]),
    "",
    "Påminnelser:",
    ...(remindersRes.data ?? [])
      .filter((r) => !r.is_done)
      .map((r) => `- ${r.title} ${fmtDate(r.remind_at, false)} [id=${r.id}]`),
    "",
    "Mina sparade platser:",
    ...(places.length
      ? places.map((p) => `- ${p.name} (${p.kind}, ${p.radius_m} m) [id=${p.id}]`)
      : ["- inga sparade platser"]),
    "",
    "Platslogg idag:",
    ...(todayVisits.length
      ? todayVisits.map(
          (v) =>
            `- ${visitLabel(v, places)} ${new Date(v.arrived_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–${v.left_at ? new Date(v.left_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "pågår"} (${formatDuration(visitMinutes(v, now))}) [id=${v.id}]`,
        )
      : ["- ingen plats registrerad idag"]),
    `Tid idag per typ: ${PLACE_KINDS.map((k) => `${k.label} ${formatDuration(todayMinutes[k.value])}`).join(", ")}`,
    `Tid denna vecka per typ: ${PLACE_KINDS.map((k) => `${k.label} ${formatDuration(weekMinutes[k.value])}`).join(", ")}`,
    "",
    "Analys:",
    todayOverlaps.length
      ? `- Krockar idag: ${todayOverlaps.map(([a, b]) => `${a.title} / ${b.title}`).join("; ")}`
      : "- Inga krockar idag",
    freeSlot
      ? `- Nästa lediga timme: ${fmt(freeSlot.start, "EEEE d MMMM HH:mm")}`
      : "- Ingen ledig timme hittad de närmaste 7 dagarna",
  ].join("\n");
}

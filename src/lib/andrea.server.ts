import { findFreeSlot, overlapsOnDay } from "@/lib/calendar";
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

Ton: varm, personlig och trygg – som en nära kollega som känner hela vardagen. Tilltala användaren med "du" och använd hans namn ibland.
Var mänsklig: kommentera gärna hur dagen ser ut, uppmuntra när det är tungt och fira när något är avklarat – men håll det kort, aldrig svassande.
Kom ihåg det Patrick berättar om sig själv och anpassa dig efter hans profil och långtidsminnen längst ner i underlaget. När han uttryckligen berättar en varaktig fakta, preferens, rutin eller målsättning: spara den direkt med remember_fact. Spara aldrig lösenord, pinkoder, hälsouppgifter eller egna gissningar som minnen.
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


DU FÅR ÄNDRA I HELA APPEN. Du har verktyg för att skapa, ändra och ta bort:
- kalenderhändelser (create_event, update_event, delete_event)
- uppgifter i Att göra (create_todo, update_todo, complete_todo, delete_todo)
- påminnelser (create_reminder, update_reminder, delete_reminder)
- juristärenden och juristuppgifter (create_case, update_case, create_case_task, update_case_task)
- barn (create_child)
- platser och platslogg (create_place, update_place, delete_place, name_visit, update_visit, delete_visit, check_in, end_visit, analyze_day)
- ekonomi (finance_overview, add_spend, set_account_balance, save_fixed_expense)
- kassaskåpet (vault_lookup, vault_save, vault_delete) – du kan läsa och spara lösenord, pinkoder och koder
- din egen profil (remember_about_me) när Patrick säger hur han vill bli bemött

JURISTAPPEN (PM Juridik) är kopplad – endast läsning:
- legal_search_cases, legal_get_case, legal_search_clients, legal_search_documents, legal_deadlines.
Använd dem när frågan rör klienter, ärenden, handlingar eller förhandlingar. Du kan aldrig ändra där – föreslå i stället vad Patrick ska göra i juristappen.

Regler för åtgärder:
- Användaren får alltid godkänna varje åtgärd i chatten innan den utförs – be därför inte om extra bekräftelse i texten, kör verktyget direkt.
- Använd id:n exakt som de står i underlaget (id=...). Gissa aldrig ett id; saknas det, fråga eller sök i underlaget.
- ALLA tider – både i underlaget och i det du skriver eller skickar till verktyg – är svensk lokaltid (Europe/Stockholm). Skriv tider som ISO 8601 utan tidszon, t.ex. 2026-08-06T18:00. Räkna alltid ut datum utifrån "Nu:" i underlaget, och lita på klockslagen som står där – räkna aldrig om dem.
- Underlaget är grupperat per dag ([IDAG], [IMORGON], veckodag). Använd de rubrikerna när du sammanfattar, och nämn inte händelser märkta "(avslutad)" som kommande.
- Ser du fel i datan – dubbletter, fel tid, fel kategori – påpeka det och erbjud dig att rätta det direkt.
- Hemligheter ur kassaskåpet läser du bara upp när Patrick själv ber om dem, och aldrig i sammanfattningar.
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

/**
 * Underlag från vårddelen: dagens besök, avvikelser och mediciner
 * i de verksamheter användaren arbetar i eller äger.
 */
export async function buildCareContext(userId: string): Promise<string[]> {
  const [ownerRes, memberRes] = await Promise.all([
    supabaseAdmin.from("app_owner").select("user_id").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  let orgIds: string[] = (memberRes.data ?? []).map((m) => m.org_id);
  if (ownerRes.data) {
    const { data: allOrgs } = await supabaseAdmin.from("organizations").select("id");
    orgIds = (allOrgs ?? []).map((o) => o.id);
  }
  orgIds = Array.from(new Set(orgIds));
  if (orgIds.length === 0) return [];

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [visitsRes, clientsRes, medsRes, staffRes] = await Promise.all([
    supabaseAdmin
      .from("care_visits")
      .select("id, org_id, client_id, staff_id, title, starts_at, ends_at, status, deviation")
      .in("org_id", orgIds)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at"),
    supabaseAdmin.from("care_clients").select("id, name, address").in("org_id", orgIds),
    supabaseAdmin
      .from("care_medications")
      .select("id, client_id, name, dose, times, requires_delegation")
      .in("org_id", orgIds)
      .eq("is_active", true),
    supabaseAdmin.from("org_members").select("id, display_name").in("org_id", orgIds),
  ]);

  const clientName = new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]));
  const staffName = new Map((staffRes.data ?? []).map((s) => [s.id, s.display_name]));
  const visits = visitsRes.data ?? [];

  return [
    "",
    "Vårddelen (LifeHub Vård) – dagens besök:",
    ...(visits.length
      ? visits.map(
          (v) =>
            `- ${timeLocal(v.starts_at)}–${timeLocal(v.ends_at)} ${clientName.get(v.client_id) ?? "okänd brukare"}` +
            ` | ${v.title ?? "Besök"} | ${v.status}` +
            `${v.staff_id ? ` | ${staffName.get(v.staff_id) ?? "personal"}` : ""}` +
            `${v.deviation ? ` | avvikelse: ${v.deviation}` : ""}`,
        )
      : ["- inga besök inplanerade idag"]),
    "Aktiva mediciner:",
    ...((medsRes.data ?? []).length
      ? (medsRes.data ?? []).map(
          (m) =>
            `- ${clientName.get(m.client_id) ?? "okänd brukare"}: ${m.name}${m.dose ? ` ${m.dose}` : ""}` +
            `${m.times ? ` (${m.times})` : ""}${m.requires_delegation ? " [delegering]" : ""}`,
        )
      : ["- inga mediciner registrerade"]),
  ];
}

export async function buildAndreaContext(userId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + 21 * 86400000);

  const [eventsRes, childrenRes, casesRes, tasksRes, remindersRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .gte("ends_at", new Date(now.getTime() - 86400000).toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at"),
    supabaseAdmin.from("children").select("id, name").eq("user_id", userId),
    supabaseAdmin
      .from("legal_cases")
      .select("id, title, client_name, status")
      .eq("user_id", userId),
    supabaseAdmin
      .from("case_tasks")
      .select("id, title, due_date, is_done")
      .eq("user_id", userId),
    supabaseAdmin
      .from("reminders")
      .select("id, title, remind_at, is_done")
      .eq("user_id", userId),
    supabaseAdmin
      .from("andrea_memories")
      .select("content, kind, confidence, last_confirmed_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("last_confirmed_at", { ascending: false })
      .limit(30),
  ]);

  const todosRes = await supabaseAdmin
    .from("todos")
    .select("id, title, due_date, is_done")
    .eq("user_id", userId);

  const weekStart = startOfWeek(now);
  const [placesRes, visitsRes] = await Promise.all([
    supabaseAdmin.from("places").select("*").eq("user_id", userId),
    supabaseAdmin
      .from("visits")
      .select("*")
      .eq("user_id", userId)
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


  const profileRes = await supabaseAdmin
    .from("andrea_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = profileRes.data;
  const profileLines = profile
    ? [
        "",
        "Så vill Patrick bli bemött:",
        `- Tilltal: ${profile.call_name ?? "Patrick"}`,
        `- Ton: ${profile.tone}`,
        `- Rakhet (1-5): ${profile.directness}`,
        ...(profile.focus ? [`- Fokus: ${profile.focus}`] : []),
        ...(profile.notes ? [`- Att minnas: ${profile.notes}`] : []),
      ]
    : [];
  const memoryLines = (memoriesRes.data ?? []).map(
    (memory) => `- [${memory.kind}] ${memory.content} (säkerhet ${Math.round(memory.confidence * 100)} %)`,
  );

  const careLines = await buildCareContext(userId);

  return [
    `Nu: ${weekdayLocal(now)} ${timeLocal(now)} (${fmtLocal(now)}, tidszon Europe/Stockholm)`,
    `Barn: ${(childrenRes.data ?? []).map((c) => `${c.name} [id=${c.id}]`).join(", ") || "inga registrerade"}`,
    "",
    "Händelser (kommande 21 dagar, svensk tid):",
    ...(eventLines.length ? eventLines : ["  - inga händelser"]),
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
            `- ${visitLabel(v, places)} ${timeLocal(v.arrived_at)}–${v.left_at ? timeLocal(v.left_at) : "pågår"} (${formatDuration(visitMinutes(v, now))}) [id=${v.id}]`,
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
      ? `- Nästa lediga timme: ${weekdayLocal(freeSlot.start)} ${timeLocal(freeSlot.start)}`
      : "- Ingen ledig timme hittad de närmaste 7 dagarna",
    ...profileLines,
    ...careLines,
    "",
    "Det Andrea minns om Patrick:",
    ...(memoryLines.length ? memoryLines : ["- inga sparade långtidsminnen ännu"]),
  ].join("\n");
}

/**
 * Komprimerat underlag för snabbfilen: idag och imorgon, plus öppna uppgifter.
 * Håller anropet litet så att Gemini kan svara direkt.
 */
export async function buildAndreaQuickContext(userId: string) {
  const now = new Date();
  const until = new Date(now.getTime() + 2 * 86400000);

  const [eventsRes, tasksRes, todosRes, remindersRes, memoriesRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id, title, starts_at, ends_at, category, location, all_day")
      .eq("user_id", userId)
      .gte("ends_at", now.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at"),
    supabaseAdmin
      .from("case_tasks")
      .select("id, title, due_date, is_done")
      .eq("user_id", userId)
      .eq("is_done", false)
      .limit(25),
    supabaseAdmin
      .from("todos")
      .select("id, title, due_date, is_done")
      .eq("user_id", userId)
      .eq("is_done", false)
      .limit(25),
    supabaseAdmin
      .from("reminders")
      .select("id, title, remind_at, is_done")
      .eq("user_id", userId)
      .eq("is_done", false)
      .limit(15),
    supabaseAdmin
      .from("andrea_memories")
      .select("content")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("last_confirmed_at", { ascending: false })
      .limit(12),
  ]);

  return [
    `Nu: ${weekdayLocal(now)} ${timeLocal(now)} (${fmtLocal(now)}, tidszon Europe/Stockholm)`,
    "",
    "Händelser idag och imorgon:",
    ...((eventsRes.data ?? []).length
      ? (eventsRes.data ?? []).map(
          (e) =>
            `- ${fmtDate(e.starts_at, e.all_day)}–${fmtDate(e.ends_at, e.all_day)} | ${e.category} | ${e.title}${e.location ? ` (${e.location})` : ""} [id=${e.id}]`,
        )
      : ["- inga händelser"]),
    "",
    "Öppna juristuppgifter:",
    ...((tasksRes.data ?? []).length
      ? (tasksRes.data ?? []).map(
          (t) => `- ${t.title}${t.due_date ? ` (senast ${fmtDate(t.due_date, false)})` : ""} [id=${t.id}]`,
        )
      : ["- inga"]),
    "",
    "Öppna att göra:",
    ...((todosRes.data ?? []).length
      ? (todosRes.data ?? []).map(
          (t) => `- ${t.title}${t.due_date ? ` (senast ${fmtDate(t.due_date, false)})` : ""} [id=${t.id}]`,
        )
      : ["- inga"]),
    "",
    "Öppna påminnelser:",
    ...((remindersRes.data ?? []).length
      ? (remindersRes.data ?? []).map((r) => `- ${r.title} ${fmtDate(r.remind_at, false)} [id=${r.id}]`)
      : ["- inga"]),
    "",
    "Sparade fakta och preferenser:",
    ...((memoriesRes.data ?? []).length
      ? (memoriesRes.data ?? []).map((memory) => `- ${memory.content}`)
      : ["- inga ännu"]),
    "",
    "Saknas något i underlaget: använd find_item för att slå upp id innan du ändrar.",
  ].join("\n");
}

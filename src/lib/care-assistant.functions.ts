import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrg, type Ctx } from "@/lib/care-admin.functions";

const SYSTEM = `Du är **Andrea**, assistenten i vårdsystemet Alfa 1.0.
Du hjälper brukare, anhöriga och personal i hemtjänsten.
Ton: varm, trygg och respektfull. Skriv på svenska, kort och lättläst – gärna punktlista med klockslag.
Utgå ENBART från underlaget. Hittar du inte svaret säger du det och föreslår att kontakta kontoret.
Ge aldrig medicinska råd eller ändra ordinationer – hänvisa till sjuksköterska.
Alla klockslag är svensk tid. Håll svaret under 120 ord.`;

function clock(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });
}

function demoAnswer(
  question: string,
  visits: Array<{ title: string | null; starts_at: string; status: string }>,
  medications: Array<{ name: string; dose: string | null; times: string | null }>,
) {
  const upcoming = visits.filter((visit) => new Date(visit.starts_at).getTime() >= Date.now());
  const next = upcoming[0];
  const q = question.toLocaleLowerCase("sv-SE");
  if (q.includes("nästa besök") || q.includes("nasta besok")) {
    return next
      ? `Ditt nästa besök är ${clock(next.starts_at)}. Då är ${next.title ?? "ett hemtjänstbesök"} planerat. Du behöver inte förbereda något särskilt.`
      : "Du har inget nytt besök registrerat den kommande veckan. Kontakta gärna kontoret om du vill dubbelkolla.";
  }
  if (q.includes("kalender") || q.includes("sju dag")) {
    return upcoming.length
      ? `Kommande besök:\n${upcoming.slice(0, 7).map((visit) => `• ${clock(visit.starts_at)} – ${visit.title ?? "Besök"}`).join("\n")}`
      : "Det finns inga planerade besök i kalendern de kommande sju dagarna.";
  }
  if (q.includes("dag") || q.includes("schema")) {
    const today = upcoming.filter((visit) => new Date(visit.starts_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }) === new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }));
    const visitText = today.length ? today.map((visit) => `• ${clock(visit.starts_at)} – ${visit.title ?? "Besök"}`).join("\n") : "• Inga fler besök idag";
    const medText = medications.slice(0, 4).map((med) => `• ${med.times ?? "Enligt ordination"} – ${med.name}${med.dose ? ` ${med.dose}` : ""}`).join("\n");
    return `Din dag:\n${visitText}${medText ? `\n\nMediciner enligt listan:\n${medText}` : ""}`;
  }
  return next
    ? `Jag hjälper gärna till. Nästa registrerade besök är ${clock(next.starts_at)} (${next.title ?? "besök"}). Du kan också välja Dagens schema eller Besök i kalender ovan.`
    : "Jag hjälper gärna till med besök, dagens schema och medicinlistan. Kontakta kontoret om något behöver ändras.";
}

/**
 * Andrea för vårddelen: svarar på frågor om besök, dagens plan,
 * insatser och mediciner för en brukare (eller hela verksamheten).
 */
export const askCareAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        clientId: z.string().uuid().optional(),
        question: z.string().min(1).max(500),
        role: z.string().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { completeText } = await import("@/lib/ai-complete.server");

    const now = new Date();
    const from = new Date(now.getTime() - 12 * 3600_000).toISOString();
    const to = new Date(now.getTime() + 7 * 86_400_000).toISOString();

    let visitQuery = context.supabase
      .from("care_visits")
      .select("id, client_id, title, starts_at, ends_at, status, deviation")
      .eq("org_id", org.id)
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at")
      .limit(60);
    if (data.clientId) visitQuery = visitQuery.eq("client_id", data.clientId);

    let medQuery = context.supabase
      .from("care_medications")
      .select("client_id, name, dose, times, requires_delegation")
      .eq("org_id", org.id)
      .eq("is_active", true);
    if (data.clientId) medQuery = medQuery.eq("client_id", data.clientId);

    let shopQuery = context.supabase
      .from("care_shopping_items")
      .select("client_id, title, quantity, is_done")
      .eq("org_id", org.id)
      .eq("is_done", false)
      .limit(60);
    if (data.clientId) shopQuery = shopQuery.eq("client_id", data.clientId);

    const [visitsRes, medsRes, clientsRes, shopRes] = await Promise.all([
      visitQuery,
      medQuery,
      context.supabase.from("care_clients").select("id, name, address").eq("org_id", org.id),
      shopQuery,
    ]);

    const names = new Map<string, string>(
      (clientsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
    );

    const lines = [
      `Verksamhet: ${org.name}`,
      `Nu: ${clock(now.toISOString())}`,
      data.role ? `Du pratar med: ${data.role}` : "",
      data.clientId ? `Gäller brukare: ${names.get(data.clientId) ?? "okänd"}` : "",
      "",
      "Besök (senaste 12 h och kommande 7 dygn):",
      ...((visitsRes.data ?? []).length
        ? (visitsRes.data ?? []).map(
            (v: {
              client_id: string;
              title: string | null;
              starts_at: string;
              ends_at: string;
              status: string;
              deviation: string | null;
            }) =>
              `- ${clock(v.starts_at)}–${clock(v.ends_at).slice(-5)} ${names.get(v.client_id) ?? "brukare"}: ${
                v.title ?? "Besök"
              } (${v.status})${v.deviation ? ` – avvikelse: ${v.deviation}` : ""}`,
          )
        : ["- inga besök i perioden"]),
      "",
      "Mediciner:",
      ...((medsRes.data ?? []).length
        ? (medsRes.data ?? []).map(
            (m: {
              client_id: string;
              name: string;
              dose: string | null;
              times: string | null;
              requires_delegation: boolean | null;
            }) =>
              `- ${names.get(m.client_id) ?? "brukare"}: ${m.name}${m.dose ? ` ${m.dose}` : ""}${
                m.times ? ` (${m.times})` : ""
              }${m.requires_delegation ? " [delegering]" : ""}`,
          )
        : ["- inga aktiva mediciner"]),
      "",
      "Att handla (ej avbockat):",
      ...((shopRes.data ?? []).length
        ? (shopRes.data ?? []).map(
            (i: { client_id: string; title: string; quantity: string | null }) =>
              `- ${names.get(i.client_id) ?? "brukare"}: ${i.title}${i.quantity ? ` (${i.quantity})` : ""}`,
          )
        : ["- inget på inköpslistan"]),
    ].filter(Boolean);

    const shopItems = (shopRes.data ?? []) as Array<{ client_id: string; title: string; quantity: string | null }>;
    if (data.slug === "alfa-demo") {
      const q = data.question.toLocaleLowerCase("sv-SE");
      if (q.includes("handla") || q.includes("inköp") || q.includes("inkop")) {
        return {
          answer: shopItems.length
            ? `Det här står på inköpslistan:\n${shopItems
                .slice(0, 8)
                .map((i) => `• ${i.title}${i.quantity ? ` (${i.quantity})` : ""} – ${names.get(i.client_id) ?? "brukare"}`)
                .join("\n")}`
            : "Inköpslistan är tom just nu.",
        };
      }
      return {
        answer: demoAnswer(
          data.question,
          (visitsRes.data ?? []) as Array<{ title: string | null; starts_at: string; status: string }>,
          (medsRes.data ?? []) as Array<{ name: string; dose: string | null; times: string | null }>,
        ),
      };
    }

    const answer = await completeText({
      system: SYSTEM,
      input: `${lines.join("\n")}\n\nFråga: ${data.question}`,
    });

    return { answer: answer || "Jag kunde tyvärr inte svara just nu. Försök igen om en stund." };
  });

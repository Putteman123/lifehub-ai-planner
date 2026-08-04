import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Du är LifeHub AI – en personlig, proaktiv planeringsassistent på svenska.
Du hjälper en förälder som jobbar heltid, tar juristuppdrag och har barn varannan vecka.
Svara alltid kort, konkret och på svenska. Använd punktlistor och klockslag.
Peka ut krockar, tidsbrist och lediga luckor. Föreslå alltid ett nästa steg.
Hitta aldrig på händelser som inte finns i underlaget – säg hellre att det saknas data.`;

function fmtDate(value: string, allDay: boolean) {
  const d = new Date(value);
  return allDay
    ? d.toLocaleDateString("sv-SE")
    : d.toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string }) => {
    const question = String(input?.question ?? "").trim();
    if (!question) throw new Error("Skriv en fråga först.");
    return { question: question.slice(0, 1000) };
  })
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI är inte konfigurerad.");

    const { supabase } = context;
    const now = new Date();
    const until = new Date(now.getTime() + 21 * 86400000);

    const [eventsRes, childrenRes, casesRes, tasksRes, remindersRes] = await Promise.all([
      supabase
        .from("events")
        .select("title, starts_at, ends_at, all_day, category, location")
        .gte("ends_at", new Date(now.getTime() - 86400000).toISOString())
        .lte("starts_at", until.toISOString())
        .order("starts_at"),
      supabase.from("children").select("name"),
      supabase.from("legal_cases").select("title, client_name, status"),
      supabase.from("case_tasks").select("title, due_date, is_done"),
      supabase.from("reminders").select("title, remind_at, is_done"),
    ]);

    const events = eventsRes.data ?? [];
    const lines = [
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
      ...((casesRes.data ?? []).map((c) => `- ${c.title} (${c.client_name ?? "–"}, ${c.status})`) || []),
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
    ];

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const { streamText } = await import("ai");

    const gateway = createLovableAiGatewayProvider(key);
    const result = streamText({
      model: gateway("openai/gpt-5.6-sol"),
      system: SYSTEM,
      prompt: `Underlag från kalendern:\n${lines.join("\n")}\n\nFråga: ${data.question}`,
      providerOptions: { lovable: { reasoningEffort: "none" } },
    });

    try {
      return { answer: await result.text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("429")) throw new Error("AI:n är överbelastad just nu – försök igen strax.");
      if (message.includes("402")) throw new Error("AI-krediterna är slut. Fyll på i arbetsytans inställningar.");
      throw new Error("AI-svaret misslyckades. Försök igen.");
    }
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeeklyReview = {
  /** ISO-datum för veckans måndag. */
  weekStart: string;
  spent: number;
  spentPrev: number;
  topCategories: { category: string; amount: number }[];
  unpaidFixed: { name: string; amount: number; period: string }[];
  upcoming: { title: string; when: string }[];
  summary: string;
  actions: string[];
};

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/** Samlar veckans siffror och låter Andrea skriva en avstämning. */
export const getWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeeklyReview> => {
    const supabase = context.supabase;
    const now = new Date();
    const start = mondayOf(now);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const nextEnd = new Date(start);
    nextEnd.setDate(nextEnd.getDate() + 14);

    const [spendRes, fixedRes, payRes, eventsRes, tasksRes] = await Promise.all([
      supabase
        .from("spend_entries")
        .select("amount, category, spent_at")
        .gte("spent_at", prevStart.toISOString()),
      supabase.from("fixed_expenses").select("id, name, amount, is_active").eq("is_active", true),
      supabase.from("fixed_expense_payments").select("expense_id, period"),
      supabase
        .from("events")
        .select("title, starts_at")
        .gte("starts_at", now.toISOString())
        .lte("starts_at", nextEnd.toISOString())
        .order("starts_at", { ascending: true })
        .limit(15),
      supabase
        .from("case_tasks")
        .select("title, due_date, is_done")
        .eq("is_done", false)
        .not("due_date", "is", null)
        .lte("due_date", nextEnd.toISOString())
        .order("due_date", { ascending: true })
        .limit(10),
    ]);

    const spendRows = spendRes.data ?? [];
    const thisWeek = spendRows.filter((r) => new Date(r.spent_at) >= start);
    const prevWeek = spendRows.filter((r) => new Date(r.spent_at) < start);
    const spent = thisWeek.reduce((s, r) => s + Number(r.amount), 0);
    const spentPrev = prevWeek.reduce((s, r) => s + Number(r.amount), 0);

    const byCat = new Map<string, number>();
    for (const row of thisWeek) {
      const key = (row.category ?? "Övrigt").trim() || "Övrigt";
      byCat.set(key, (byCat.get(key) ?? 0) + Number(row.amount));
    }
    const topCategories = [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const paidIds = new Set(
      (payRes.data ?? []).filter((p) => p.period === period).map((p) => p.expense_id),
    );
    const unpaidFixed = (fixedRes.data ?? [])
      .filter((f) => !paidIds.has(f.id))
      .map((f) => ({ name: f.name, amount: Number(f.amount), period }))
      .slice(0, 8);

    const upcoming = [
      ...(eventsRes.data ?? []).map((e) => ({
        title: e.title,
        when: new Date(e.starts_at).toLocaleDateString("sv-SE", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      })),
      ...(tasksRes.data ?? []).map((t) => ({
        title: `Jurist: ${t.title}`,
        when: t.due_date
          ? new Date(t.due_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
          : "",
      })),
    ].slice(0, 12);

    const base: WeeklyReview = {
      weekStart: start.toISOString(),
      spent,
      spentPrev,
      topCategories,
      unpaidFixed,
      upcoming,
      summary: "",
      actions: [],
    };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return base;

    const { completeText } = await import("@/lib/ai-complete.server");
    const input = [
      `Spenderat denna vecka: ${Math.round(spent)} kr (förra veckan ${Math.round(spentPrev)} kr).`,
      `Största kategorier: ${topCategories.map((c) => `${c.category} ${Math.round(c.amount)} kr`).join(", ") || "inga köp"}.`,
      `Fasta utgifter denna månad: ${unpaidFixed.map((f) => `${f.name} ${Math.round(f.amount)} kr`).join(", ") || "inga"}.`,
      `Kommande två veckor: ${upcoming.map((u) => `${u.when} ${u.title}`).join("; ") || "tomt"}.`,
    ].join("\n");

    try {
      const text = await completeText({
        apiKey,
        system:
          "Du är Andrea, Patricks svenska assistent. Skriv en veckoavstämning: 'summary' är 3–4 korta meningar om veckan som gått (pengar, avvikelser, vad som sticker ut) och vad nästa vecka kräver. 'actions' är 2–5 konkreta uppgifter formulerade som korta todo-rader på svenska, utan numrering. Använd bara siffror ur underlaget, hitta aldrig på. Svara enbart med JSON.",
        input,
        jsonSchema: {
          name: "weekly_review",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "actions"],
            properties: {
              summary: { type: "string" },
              actions: { type: "array", items: { type: "string" } },
            },
          },
        },
      });
      const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; actions?: string[] };
      base.summary = parsed.summary ?? "";
      base.actions = (parsed.actions ?? []).slice(0, 5);
    } catch {
      base.summary = "";
    }

    return base;
  });

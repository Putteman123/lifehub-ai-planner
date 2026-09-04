import type { SupabaseClient } from "@supabase/supabase-js";

import { completeText } from "@/lib/ai-complete.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function dayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Samlar dagens läge och låter AI skriva en kort briefing. */
export async function buildBriefing(supabase: Client, userId: string) {
  const now = new Date();
  const { start, end } = dayBounds(now);

  const [events, todos, accounts, fixed] = await Promise.all([
    supabase
      .from("events")
      .select("title, starts_at, ends_at, all_day, location, category")
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
    supabase
      .from("todos")
      .select("title, due_date")
      .eq("is_done", false)
      .order("due_date", { nullsFirst: false })
      .limit(10),
    supabase.from("finance_accounts").select("name, balance").order("sort_order"),
    supabase
      .from("fixed_expenses")
      .select("name, amount, due_day")
      .eq("is_active", true)
      .order("due_day"),
  ]);

  const balance = (accounts.data ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const soon = (fixed.data ?? []).filter(
    (f) => f.due_day >= now.getDate() && f.due_day <= now.getDate() + 7,
  );

  const facts = [
    `Datum: ${now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}`,
    `Aktiviteter i dag: ${
      (events.data ?? []).length === 0
        ? "inga"
        : (events.data ?? [])
            .map(
              (e) =>
                `${e.all_day ? "heldag" : new Date(e.starts_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} ${e.title}${e.location ? ` (${e.location})` : ""}`,
            )
            .join("; ")
    }`,
    `Öppna uppgifter: ${
      (todos.data ?? []).length === 0
        ? "inga"
        : (todos.data ?? []).map((t) => t.title).join("; ")
    }`,
    `Totalt saldo: ${Math.round(balance)} kr`,
    `Fasta utgifter inom en vecka: ${
      soon.length === 0 ? "inga" : soon.map((f) => `${f.name} ${Math.round(Number(f.amount))} kr (den ${f.due_day})`).join("; ")
    }`,
  ].join("\n");

  const text = await completeText({
    system:
      "Du är Andrea, Patricks personliga assistent. Skriv en kort morgonbriefing på svenska: 2–4 meningar, konkret och lugn, utan punktlistor och utan att hitta på något som inte står i underlaget. Avsluta med en enda tydlig rekommendation för dagen.",
    input: facts,
  });

  return {
    text: text.trim(),
    eventCount: (events.data ?? []).length,
    todoCount: (todos.data ?? []).length,
    balance: Math.round(balance),
    generatedAt: new Date().toISOString(),
  };
}

/** Kort ekonomicoach: vad saldot räcker till och vad som bör hända nu. */
export async function buildMoneyCoach(supabase: Client, userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [accounts, spend, incomes, fixed] = await Promise.all([
    supabase.from("finance_accounts").select("name, balance"),
    supabase.from("spend_entries").select("amount, category").gte("spent_at", monthStart),
    supabase
      .from("finance_incomes")
      .select("label, amount, expected_on, is_received")
      .gte("expected_on", now.toISOString().slice(0, 10)),
    supabase.from("fixed_expenses").select("name, amount, due_day").eq("is_active", true),
  ]);

  const balance = (accounts.data ?? []).reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const spent = (spend.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const upcomingFixed = (fixed.data ?? [])
    .filter((f) => f.due_day >= now.getDate())
    .reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const upcomingIncome = (incomes.data ?? [])
    .filter((i) => !i.is_received)
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const free = balance + upcomingIncome - upcomingFixed;
  const perDay = daysLeft > 0 ? Math.floor(free / daysLeft) : free;

  const text = await completeText({
    system:
      "Du är en rak och vänlig ekonomicoach. Svara på svenska i högst tre meningar, utan listor. Utgå bara från siffrorna du får. Säg vad som är rimligt att göra denna vecka.",
    input: [
      `Saldo nu: ${Math.round(balance)} kr`,
      `Spenderat denna månad: ${Math.round(spent)} kr`,
      `Kvarvarande fasta utgifter denna månad: ${Math.round(upcomingFixed)} kr`,
      `Väntade inkomster: ${Math.round(upcomingIncome)} kr`,
      `Dagar kvar i månaden: ${daysLeft}`,
      `Beräknat utrymme per dag: ${perDay} kr`,
    ].join("\n"),
  });

  return {
    text: text.trim(),
    perDay,
    free: Math.round(free),
    daysLeft,
    generatedAt: new Date().toISOString(),
  };
}

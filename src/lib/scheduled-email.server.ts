/**
 * Schemalagda utskick: veckosammanfattning (söndag kväll) och dagliga
 * påminnelser. Körs från /api/public/hooks/epost via pg_cron.
 * Serveronly – importeras aldrig från klientkod.
 */

type Owner = { userId: string; email: string; name: string };

async function getOwner(): Promise<Owner | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: owner } = await supabaseAdmin.from("app_owner").select("user_id").maybeSingle();
  const userId = owner?.user_id;
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  const email = (profile?.email as string | null) ?? process.env["APP_OWNER_EMAIL"] ?? "";
  if (!email) return null;

  const name = ((profile?.full_name as string | null) ?? "").split(" ")[0] ?? "";
  return { userId, email, name };
}

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

/** Veckans siffror + Andreas text, skickat som ett mejl till appägaren. */
export async function sendWeeklySummaryEmail() {
  const owner = await getOwner();
  if (!owner) return { sent: false, reason: "ingen-mottagare" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const start = mondayOf(now);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);

  const [spendRes, fixedRes, payRes] = await Promise.all([
    supabaseAdmin
      .from("spend_entries")
      .select("amount, category, spent_at")
      .eq("user_id", owner.userId)
      .gte("spent_at", prevStart.toISOString()),
    supabaseAdmin
      .from("fixed_expenses")
      .select("id, name, amount, is_active")
      .eq("user_id", owner.userId)
      .eq("is_active", true),
    supabaseAdmin
      .from("fixed_expense_payments")
      .select("expense_id, period")
      .eq("user_id", owner.userId),
  ]);

  const rows = spendRes.data ?? [];
  const thisWeek = rows.filter((r) => new Date(r.spent_at) >= start);
  const prevWeek = rows.filter((r) => new Date(r.spent_at) < start);
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
  const paid = new Set((payRes.data ?? []).filter((p) => p.period === period).map((p) => p.expense_id));
  const unpaid = (fixedRes.data ?? []).filter((f) => !paid.has(f.id)).map((f) => f.name).slice(0, 8);

  let summary = "";
  let actions: string[] = [];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (apiKey) {
    try {
      const { completeText } = await import("@/lib/ai-complete.server");
      const text = await completeText({
        apiKey,
        system:
          "Du är Andrea, Patricks svenska assistent. Skriv en veckoavstämning: 'summary' är 3–4 korta meningar. 'actions' är 2–5 korta todo-rader på svenska. Använd bara siffror ur underlaget. Svara enbart med JSON.",
        input: [
          `Spenderat denna vecka: ${Math.round(spent)} kr (förra veckan ${Math.round(spentPrev)} kr).`,
          `Största kategorier: ${topCategories.map((c) => `${c.category} ${Math.round(c.amount)} kr`).join(", ") || "inga köp"}.`,
          `Obetalda fasta utgifter: ${unpaid.join(", ") || "inga"}.`,
        ].join("\n"),
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
      const parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as {
        summary?: string;
        actions?: string[];
      };
      summary = parsed.summary ?? "";
      actions = (parsed.actions ?? []).slice(0, 5);
    } catch {
      summary = "";
    }
  }

  const weekLabel = start.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const result = await sendTemplateEmail("weekly-summary", owner.email, {
    idempotencyKey: `weekly-summary-${owner.userId}-${start.toISOString().slice(0, 10)}`,
    templateData: {
      name: owner.name,
      weekLabel: `vecka från ${weekLabel}`,
      spent,
      diff: spent - spentPrev,
      topCategories,
      unpaid,
      actions,
      summary,
    },
  });

  return { sent: result.sent, spent, items: topCategories.length };
}

/** Dagliga påminnelser: förfallande fasta utgifter och egna påminnelser. */
export async function sendDailyRemindersEmail() {
  const owner = await getOwner();
  if (!owner) return { sent: false, reason: "ingen-mottagare" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 3);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [remRes, fixedRes, payRes] = await Promise.all([
    supabaseAdmin
      .from("reminders")
      .select("title, remind_at, is_done")
      .eq("user_id", owner.userId)
      .eq("is_done", false)
      .lte("remind_at", horizon.toISOString())
      .order("remind_at", { ascending: true })
      .limit(15),
    supabaseAdmin
      .from("fixed_expenses")
      .select("id, name, amount, due_day, is_active")
      .eq("user_id", owner.userId)
      .eq("is_active", true),
    supabaseAdmin
      .from("fixed_expense_payments")
      .select("expense_id, period")
      .eq("user_id", owner.userId),
  ]);

  const paid = new Set((payRes.data ?? []).filter((p) => p.period === period).map((p) => p.expense_id));
  const dueSoon = (fixedRes.data ?? [])
    .filter((f) => !paid.has(f.id))
    .filter((f) => {
      const diff = Number(f.due_day) - now.getDate();
      return diff >= -30 && diff <= 3;
    })
    .map((f) => ({
      label: `${f.name} – ${kr(Number(f.amount))}`,
      due: `förfaller den ${f.due_day}:e`,
    }));

  const reminders = (remRes.data ?? []).map((r) => ({
    label: r.title,
    due: new Date(r.remind_at).toLocaleString("sv-SE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const items = [...reminders, ...dueSoon];
  if (items.length === 0) return { sent: false, reason: "inget-att-paminna-om" as const };

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const result = await sendTemplateEmail("reminder", owner.email, {
    idempotencyKey: `daily-reminders-${owner.userId}-${now.toISOString().slice(0, 10)}`,
    templateData: {
      title: items.length === 1 ? items[0]!.label : `${items.length} saker att hålla koll på`,
      message: "Det här ligger närmast i tiden.",
      items,
    },
  });

  return { sent: result.sent, count: items.length };
}

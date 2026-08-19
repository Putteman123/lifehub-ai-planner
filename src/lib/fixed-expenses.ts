import type { Tables } from "@/integrations/supabase/types";
import type { FixedExpenseRow } from "@/lib/finance";

export type FixedPaymentRow = Tables<"fixed_expense_payments">;

/** Månadsnyckel i formatet YYYY-MM (svensk tid). */
export function periodKey(date: Date | string = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

/** Föregående månad relativt en period ("2026-08" → "2026-07"). */
export function previousPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Läsbar månad, t.ex. "juli". */
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, 1).toLocaleDateString("sv-SE", { month: "long" });
}

export type FixedStatus = "betald" | "kommande" | "forsenad";

export type FixedView = {
  row: FixedExpenseRow;
  status: FixedStatus;
  payment: FixedPaymentRow | null;
  /** Obetalda månader före innevarande, äldst först. */
  carryOver: string[];
};

/**
 * Sätter status för varje fast utgift i innevarande månad och listar
 * obetalda tidigare månader (restskulder som ska följa med framåt).
 */
export function fixedViews(
  expenses: FixedExpenseRow[],
  payments: FixedPaymentRow[],
  now = new Date(),
  monthsBack = 6,
): FixedView[] {
  const period = periodKey(now);
  const paidSet = new Set(payments.map((p) => `${p.expense_id}:${p.period}`));

  const periods: string[] = [];
  let cursor = previousPeriod(period);
  for (let i = 0; i < monthsBack; i += 1) {
    periods.unshift(cursor);
    cursor = previousPeriod(cursor);
  }

  return expenses.map((row) => {
    const payment = payments.find((p) => p.expense_id === row.id && p.period === period) ?? null;
    const dayOfMonth = Number(
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric" }).format(now),
    );
    const status: FixedStatus = payment
      ? "betald"
      : dayOfMonth > row.due_day
        ? "forsenad"
        : "kommande";

    const created = periodKey(row.created_at);
    const carryOver = row.is_active
      ? periods.filter((p) => p >= created && !paidSet.has(`${row.id}:${p}`))
      : [];

    return { row, status, payment, carryOver };
  });
}

/** Summa som fortfarande ska betalas: innevarande månad + restskulder. */
export function unpaidFixedTotal(views: FixedView[]) {
  return views
    .filter((v) => v.row.is_active)
    .reduce(
      (sum, v) =>
        sum +
        (v.status === "betald" ? 0 : Number(v.row.amount)) +
        v.carryOver.length * Number(v.row.amount),
      0,
    );
}

/** Markör i uppgiftens anteckning som kopplar todo ↔ betalning. */
export function fixedTodoMarker(expenseId: string, period: string) {
  return `fixed:${expenseId}:${period}`;
}

export function parseFixedTodoMarker(notes: string | null) {
  const match = /fixed:([0-9a-f-]{36}):(\d{4}-\d{2})/i.exec(notes ?? "");
  return match ? { expenseId: match[1]!, period: match[2]! } : null;
}

/**
 * Enkel poäng för hur väl en faktura matchar en fast utgift. Används som
 * snabb gissning innan Andrea får avgöra tveksamma fall.
 */
export function matchScore(
  expense: FixedExpenseRow,
  invoice: { text: string; amount: number | null },
) {
  const name = expense.name.toLowerCase();
  const text = invoice.text.toLowerCase();
  let score = 0;
  if (name && text.includes(name)) score += 0.6;
  else if (name.split(/\s+/).some((w) => w.length > 3 && text.includes(w))) score += 0.3;

  const amount = Number(expense.amount);
  if (invoice.amount && amount > 0) {
    const diff = Math.abs(invoice.amount - amount) / amount;
    if (diff < 0.01) score += 0.4;
    else if (diff < 0.1) score += 0.2;
  }
  return Math.min(score, 1);
}

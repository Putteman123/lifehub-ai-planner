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

export type FixedStatus = "betald" | "kommande" | "forsenad" | "vilande";

export type FixedView = {
  row: FixedExpenseRow;
  status: FixedStatus;
  payment: FixedPaymentRow | null;
  /** Obetalda månader före innevarande, äldst först. */
  carryOver: string[];
  /** Nästa månad posten förfaller (YYYY-MM). */
  nextPeriod: string;
};

/** Valbara intervall för en fast utgift/prenumeration. */
export const FIXED_INTERVALS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Varje månad", short: "mån" },
  { value: 3, label: "Var tredje månad", short: "kvartal" },
  { value: 6, label: "Var sjätte månad", short: "halvår" },
  { value: 12, label: "En gång per år", short: "år" },
];

export function intervalLabel(months: number) {
  return FIXED_INTERVALS.find((i) => i.value === months)?.label ?? `Var ${months}:e månad`;
}

/** Tydlig etikett för hur en fast utgifts intervall och start/ankarmånad räknas ut. */
export function fixedDueExplanation(row: IntervalRow & { created_at?: string | null }) {
  const step = Math.max(Number(row.interval_months ?? 1) || 1, 1);
  const start = row.created_at ? periodKey(row.created_at) : periodKey();
  if (row.anchor_month) {
    const anchor = `${new Date().getFullYear()}-${String(row.anchor_month).padStart(2, "0")}`;
    return `${intervalLabel(step)} från ${periodLabel(anchor)} (ankarmånad)`;
  }
  return `${intervalLabel(step)} från ${periodLabel(start)}`;
}


function monthIndex(period: string) {
  const [y, m] = period.split("-").map(Number);
  return (y ?? 2000) * 12 + ((m ?? 1) - 1);
}

function addMonths(period: string, count: number) {
  const total = monthIndex(period) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

type IntervalRow = {
  interval_months?: number | null;
  anchor_month?: number | null;
  created_at?: string | null;
};

/** Sant om posten faktiskt ska betalas under angiven månad. */
export function isDueInPeriod(row: IntervalRow, period: string) {
  const step = Math.max(Number(row.interval_months ?? 1) || 1, 1);
  if (step === 1) return true;
  const anchor = row.anchor_month
    ? ((Number(row.anchor_month) - 1) % 12 + 12) % 12
    : monthIndex(periodKey(row.created_at ?? new Date())) % 12;
  return ((monthIndex(period) % 12) - anchor + 24) % step === 0;
}

/** Nästa månad (inklusive angiven) då posten förfaller. */
export function nextDuePeriod(row: IntervalRow, from = periodKey()) {
  let cursor = from;
  for (let i = 0; i < 24; i += 1) {
    if (isDueInPeriod(row, cursor)) return cursor;
    cursor = addMonths(cursor, 1);
  }
  return from;
}

/** Alla förfallomånader framåt, t.ex. för kalendersynk. */
export function duePeriods(row: IntervalRow, from = periodKey(), months = 12) {
  const out: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const period = addMonths(from, i);
    if (isDueInPeriod(row, period)) out.push(period);
  }
  return out;
}

/**
 * Faktisk kostnad för en fast utgift under de senaste `days` dagarna:
 * beloppet gånger antalet månader posten verkligen förfaller i fönstret
 * (aldrig proportionerligt uppskattat). Poster som skapats senare räknas
 * först från och med sin startmånad.
 */
export function dueMonthsInWindow(
  row: IntervalRow & { created_at?: string | null },
  days: number,
  now = new Date(),
) {
  const endPeriod = periodKey(now);
  const startPeriod = periodKey(new Date(now.getTime() - days * 86400000));
  const created = row.created_at ? periodKey(row.created_at) : startPeriod;
  const months = monthIndex(endPeriod) - monthIndex(startPeriod) + 1;
  const out: string[] = [];
  for (let i = 0; i < months; i += 1) {
    const period = addMonths(startPeriod, i);
    if (period >= created && isDueInPeriod(row, period)) out.push(period);
  }
  return out;
}

export function fixedAmountInWindow(
  row: IntervalRow & { amount: number | string; created_at?: string | null },
  days: number,
  now = new Date(),
) {
  return Number(row.amount) * dueMonthsInWindow(row, days, now).length;
}


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
    const dueNow = isDueInPeriod(row, period);
    const status: FixedStatus = payment
      ? "betald"
      : !dueNow
        ? "vilande"
        : dayOfMonth > row.due_day
          ? "forsenad"
          : "kommande";

    const created = periodKey(row.created_at);
    const carryOver = row.is_active
      ? periods.filter((p) => p >= created && isDueInPeriod(row, p) && !paidSet.has(`${row.id}:${p}`))
      : [];

    return { row, status, payment, carryOver, nextPeriod: nextDuePeriod(row, period) };
  });
}


/** Summa som fortfarande ska betalas: innevarande månad + restskulder. */
export function unpaidFixedTotal(views: FixedView[]) {
  return views
    .filter((v) => v.row.is_active)
    .reduce(
      (sum, v) =>
        sum +
        (v.status === "betald" || v.status === "vilande" ? 0 : Number(v.row.amount)) +
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

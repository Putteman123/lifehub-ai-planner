import { incomeDate, type IncomeRow, type SpendRow } from "@/lib/finance";
import type { FixedPaymentRow } from "@/lib/fixed-expenses";
import { spendCategory } from "@/lib/spend-breakdown";

export type MonthKey = { year: number; month: number };

/** Månadsnyckeln (0-indexerad månad) för ett datum. */
export function monthOf(date: Date = new Date()): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Förskjuter en månad framåt eller bakåt. */
export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const d = new Date(key.year, key.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Start (inklusive) och slut (exklusive) för en månad. */
export function monthWindow(key: MonthKey) {
  return {
    start: new Date(key.year, key.month, 1),
    end: new Date(key.year, key.month + 1, 1),
  };
}

/** "2026-09" – används för att jämföra datumsträngar utan tidszonstrul. */
export function monthPrefix(key: MonthKey) {
  return `${key.year}-${String(key.month + 1).padStart(2, "0")}`;
}

export function monthLabel(key: MonthKey) {
  return new Date(key.year, key.month, 1).toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
  });
}

export type MonthSummary = {
  income: number;
  spent: number;
  fixedPaid: number;
  net: number;
  incomes: IncomeRow[];
  spends: SpendRow[];
  byCategory: { name: string; value: number }[];
  byDay: { day: number; in: number; out: number }[];
};

/**
 * Månadens ekonomi: mottagna inbetalningar in, registrerade köp plus betalda
 * fasta utgifter ut, och nettot mellan dem.
 */
export function monthSummary(
  key: MonthKey,
  spends: SpendRow[],
  incomes: IncomeRow[],
  payments: FixedPaymentRow[] = [],
): MonthSummary {
  const { start, end } = monthWindow(key);
  const prefix = monthPrefix(key);
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };

  const monthSpends = spends
    .filter((row) => inWindow(row.spent_at))
    .sort((a, b) => b.spent_at.localeCompare(a.spent_at));
  const monthIncomes = incomes
    .filter((row) => row.is_received && incomeDate(row).startsWith(prefix))
    .sort((a, b) => incomeDate(b).localeCompare(incomeDate(a)));
  const monthFixed = payments.filter((row) => (row.paid_on ?? "").startsWith(prefix));

  const spent = monthSpends.reduce((sum, row) => sum + Number(row.amount), 0);
  const fixedPaid = monthFixed.reduce((sum, row) => sum + Number(row.amount), 0);
  const income = monthIncomes.reduce((sum, row) => sum + Number(row.amount), 0);

  const cats = new Map<string, number>();
  for (const row of monthSpends) {
    cats.set(spendCategory(row), (cats.get(spendCategory(row)) ?? 0) + Number(row.amount));
  }

  const days = new Date(key.year, key.month + 1, 0).getDate();
  const byDay = Array.from({ length: days }, (_, i) => ({ day: i + 1, in: 0, out: 0 }));
  for (const row of monthSpends) {
    const d = new Date(row.spent_at).getDate();
    const bucket = byDay[d - 1];
    if (bucket) bucket.out += Number(row.amount);
  }
  for (const row of monthIncomes) {
    const d = Number(incomeDate(row).slice(8, 10));
    const bucket = byDay[d - 1];
    if (bucket) bucket.in += Number(row.amount);
  }

  return {
    income,
    spent,
    fixedPaid,
    net: income - (spent + fixedPaid),
    incomes: monthIncomes,
    spends: monthSpends,
    byCategory: [...cats.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value),
    byDay,
  };
}

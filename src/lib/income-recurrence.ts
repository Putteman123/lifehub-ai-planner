import { incomeDate, type IncomeRow, type SpendRow } from "@/lib/finance";

/** Text som markerar en rad som automatiskt framskriven av appen. */
export const AUTO_NOTE = "Automatiskt framskriven från tidigare månader";

export function isAutoRow(row: { note?: string | null }) {
  return (row.note ?? "").startsWith(AUTO_NOTE);
}

/** Jämförbar nyckel för en post: gemener, utan siffror och extra tecken. */
export function labelKey(label: string) {
  return label
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function monthKeyOf(iso: string) {
  return iso.slice(0, 7);
}

/** "2026-09" plus n månader. */
export function addMonths(monthKey: string, n: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Number(y), Number(m) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sätter ett datum i en månad, klippt till månadens sista dag. */
export function dateInMonth(monthKey: string, day: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Number(y), Number(m), 0).getDate();
  const safe = Math.min(Math.max(day, 1), last);
  return `${monthKey}-${String(safe).padStart(2, "0")}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export type RecurringIncome = {
  key: string;
  label: string;
  kind: string;
  amount: number;
  day: number;
  accountId: string | null;
  months: string[];
};

/**
 * Hittar inbetalningar som återkommer månad efter månad. En post räknas som
 * återkommande när samma namn dykt upp minst två av de senaste sex månaderna.
 */
export function detectRecurringIncomes(
  incomes: IncomeRow[],
  now = new Date(),
  minMonths = 2,
  lookback = 6,
): RecurringIncome[] {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const oldest = addMonths(thisMonth, -lookback);

  const groups = new Map<string, IncomeRow[]>();
  for (const row of incomes) {
    const month = monthKeyOf(incomeDate(row));
    if (month < oldest || month > thisMonth) continue;
    const key = labelKey(row.label);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const out: RecurringIncome[] = [];
  for (const [key, rows] of groups) {
    const months = [...new Set(rows.map((r) => monthKeyOf(incomeDate(r))))].sort();
    if (months.length < minMonths) continue;
    const latest = [...rows].sort((a, b) => incomeDate(a).localeCompare(incomeDate(b))).at(-1)!;
    out.push({
      key,
      label: latest.label,
      kind: latest.kind,
      amount: Math.round(median(rows.map((r) => Number(r.amount)))),
      day: Math.round(median(rows.map((r) => Number(incomeDate(r).slice(8, 10))))),
      accountId: latest.account_id,
      months,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export type PlannedIncome = {
  label: string;
  amount: number;
  expected_on: string;
  kind: string;
  account_id: string | null;
  is_received: boolean;
  note: string;
};

/**
 * Rader som saknas för de kommande månaderna: en per återkommande inbetalning
 * och månad där ingen post redan finns.
 */
export function planIncomes(
  incomes: IncomeRow[],
  templates: RecurringIncome[],
  months: string[],
): PlannedIncome[] {
  const existing = new Set(
    incomes.map((row) => `${labelKey(row.label)}|${monthKeyOf(incomeDate(row))}`),
  );
  const planned: PlannedIncome[] = [];
  for (const template of templates) {
    for (const month of months) {
      const id = `${template.key}|${month}`;
      if (existing.has(id)) continue;
      existing.add(id);
      planned.push({
        label: template.label,
        amount: template.amount,
        expected_on: dateInMonth(month, template.day),
        kind: template.kind,
        account_id: template.accountId,
        is_received: false,
        note: AUTO_NOTE,
      });
    }
  }
  return planned;
}

export type RecurringSpend = {
  key: string;
  label: string;
  amount: number;
  day: number;
  category: string | null;
  months: string[];
};

/**
 * Köp som återkommer varje månad (till exempel abonnemang som betalas med
 * kort) och därför bör bli en fast utgift.
 */
export function detectRecurringSpends(
  spends: SpendRow[],
  now = new Date(),
  minMonths = 3,
  lookback = 6,
): RecurringSpend[] {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const oldest = addMonths(thisMonth, -lookback);

  const groups = new Map<string, SpendRow[]>();
  for (const row of spends) {
    const month = monthKeyOf(row.spent_at);
    if (month < oldest || month > thisMonth) continue;
    const key = labelKey(row.note ?? "");
    if (!key || key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const out: RecurringSpend[] = [];
  for (const [key, rows] of groups) {
    const months = [...new Set(rows.map((r) => monthKeyOf(r.spent_at)))].sort();
    if (months.length < minMonths) continue;
    const amounts = rows.map((r) => Number(r.amount));
    const mid = median(amounts);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    if (mid <= 0 || spread > mid * 0.35) continue;
    const latest = [...rows].sort((a, b) => a.spent_at.localeCompare(b.spent_at)).at(-1)!;
    out.push({
      key,
      label: (latest.note ?? "").trim(),
      amount: Math.round(mid),
      day: Math.round(median(rows.map((r) => new Date(r.spent_at).getDate()))),
      category: latest.category,
      months,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

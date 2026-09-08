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
  accountId: string | null;
  months: string[];
};

/** Kontot som posten oftast betalats från. */
function commonAccount(rows: Array<{ account_id: string | null }>): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.account_id) continue;
    counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}


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
      accountId: commonAccount(rows),
      months,
    });
  }

  return out.sort((a, b) => b.amount - a.amount);
}

export type PlannedFixed = {
  key: string;
  name: string;
  amount: number;
  due_day: number;
  category: string | null;
  account_id: string | null;
  months: number;
};

/**
 * Återkommande köp som ännu inte finns som fast utgift, färdiga att läggas in
 * med det belopp och det konto de faktiskt betalats med.
 */
export function planFixedExpenses(
  spends: SpendRow[],
  fixed: Array<{ name: string }>,
  now = new Date(),
): PlannedFixed[] {
  const known = new Set(fixed.map((row) => labelKey(row.name)));
  return detectRecurringSpends(spends, now)
    .filter((row) => row.label && !known.has(row.key))
    .map((row) => ({
      key: row.key,
      name: row.label,
      amount: row.amount,
      due_day: Math.min(Math.max(row.day, 1), 28),
      category: row.category,
      account_id: row.accountId,
      months: row.months.length,
    }));
}

export type FixedDrift = {
  id: string;
  name: string;
  current: number;
  suggested: number;
  months: number;
};

/**
 * Fasta utgifter där de faktiskt betalda beloppen skiljer sig från det
 * sparade beloppet – så månadsbilden bygger på verkliga siffror.
 */
export function fixedAmountDrift(
  fixed: Array<{ id: string; name: string; amount: number; is_active: boolean }>,
  payments: Array<{ expense_id: string; amount: number; period: string }>,
  minMonths = 2,
  tolerance = 0.05,
): FixedDrift[] {
  const byExpense = new Map<string, Array<{ amount: number; period: string }>>();
  for (const p of payments) {
    byExpense.set(p.expense_id, [
      ...(byExpense.get(p.expense_id) ?? []),
      { amount: Number(p.amount), period: p.period },
    ]);
  }

  const out: FixedDrift[] = [];
  for (const row of fixed) {
    if (!row.is_active) continue;
    const history = (byExpense.get(row.id) ?? [])
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-3);
    if (history.length < minMonths) continue;
    const suggested = Math.round(median(history.map((h) => h.amount)));
    const current = Number(row.amount);
    if (suggested <= 0 || Math.abs(suggested - current) <= current * tolerance) continue;
    out.push({ id: row.id, name: row.name, current, suggested, months: history.length });
  }
  return out.sort((a, b) => Math.abs(b.suggested - b.current) - Math.abs(a.suggested - a.current));
}

/** Kontot en fast utgift oftast betalats från, enligt betalningshistoriken. */
export function fixedAccountFromHistory(
  expenseId: string,
  payments: Array<{ expense_id: string; account_id: string | null }>,
): string | null {
  return commonAccount(payments.filter((p) => p.expense_id === expenseId));
}


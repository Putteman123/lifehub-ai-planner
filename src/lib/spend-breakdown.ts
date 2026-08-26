import type { FixedExpenseRow, SpendRow } from "@/lib/finance";
import { fixedAmountInWindow } from "@/lib/fixed-expenses";

export const DEFAULT_SPEND_CATEGORY = "Övrigt";
export const DEFAULT_FIXED_CATEGORY = "Boende";

export function spendCategory(row: { category?: string | null }) {
  return (row.category ?? "").trim() || DEFAULT_SPEND_CATEGORY;
}

export function fixedCategory(row: { category?: string | null }) {
  return (row.category ?? "").trim() || DEFAULT_FIXED_CATEGORY;
}

/** Kategorisummor för tårtdiagrammet (avrundade, störst först). */
export function spendSlices(
  spends: SpendRow[],
  fixed: FixedExpenseRow[],
  days: number,
  withFixed: boolean,
  now = new Date(),
): { name: string; value: number }[] {
  const since = now.getTime() - days * 86400000;
  const sums = new Map<string, number>();
  const add = (name: string, amount: number) => {
    if (!(amount > 0)) return;
    sums.set(name, (sums.get(name) ?? 0) + amount);
  };

  for (const row of spends) {
    if (new Date(row.spent_at).getTime() < since) continue;
    add(spendCategory(row), Number(row.amount));
  }

  if (withFixed) {
    for (const row of fixed) {
      if (!row.is_active) continue;
      add(fixedCategory(row), fixedAmountInWindow(row, days, now));
    }
  }

  return [...sums.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

/** Detaljerad uppdelning för en enskild kategori (samma fönsterlogik som diagrammet). */
export function categoryBreakdown(
  category: string,
  spends: SpendRow[],
  fixed: FixedExpenseRow[],
  days: number,
  now = new Date(),
) {
  const since = now.getTime() - days * 86400000;
  const key = category.toLowerCase();

  const rows = spends
    .filter((row) => spendCategory(row).toLowerCase() === key)
    .filter((row) => new Date(row.spent_at).getTime() >= since)
    .sort((a, b) => b.spent_at.localeCompare(a.spent_at));

  const fixedRows = fixed.filter((row) => row.is_active && fixedCategory(row).toLowerCase() === key);

  const spendTotal = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const fixedTotal = fixedRows.reduce((sum, r) => sum + fixedAmountInWindow(r, days, now), 0);

  return { rows, fixedRows, spendTotal, fixedTotal, total: spendTotal + fixedTotal };
}

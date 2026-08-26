import { describe, expect, it } from "vitest";

import type { FixedExpenseRow, SpendRow } from "@/lib/finance";
import {
  categoryBreakdown,
  monthToDateDays,
  monthToDateSpend,
  spendSlices,
} from "@/lib/spend-breakdown";
import { fixedAmountInWindow } from "@/lib/fixed-expenses";

const NOW = new Date("2026-08-26T08:00:00+02:00");

function spend(partial: Partial<SpendRow> & { amount: number; spent_at: string }): SpendRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    account_id: null,
    category: null,
    note: null,
    created_at: partial.spent_at,
    ...partial,
  } as unknown as SpendRow;
}

function fixedExpense(
  partial: Partial<FixedExpenseRow> & { amount: number; name: string },
): FixedExpenseRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    due_day: 1,
    is_active: true,
    category: null,
    interval_months: 1,
    anchor_month: null,
    created_at: "2025-01-01T00:00:00Z",
    ...partial,
  } as unknown as FixedExpenseRow;
}

const spends: SpendRow[] = [
  spend({ amount: 250, spent_at: "2026-08-20", category: "Mat" }),
  spend({ amount: 89, spent_at: "2026-08-25", category: "Cigaretter" }),
  spend({ amount: 120, spent_at: "2026-08-01", category: "Mat" }),
  spend({ amount: 999, spent_at: "2025-11-01", category: "Mat" }), // utanför 30/90 dagar
  spend({ amount: 60, spent_at: "2026-08-10" }), // saknar kategori → Övrigt
];

const fixed: FixedExpenseRow[] = [
  fixedExpense({ name: "Hyra", amount: 9000, category: "Boende" }),
  fixedExpense({ name: "Försäkring", amount: 1200, interval_months: 3, anchor_month: 2 }),
  fixedExpense({ name: "Gammalt avtal", amount: 500, category: "Mat", is_active: false }),
  fixedExpense({ name: "Streaming", amount: 149, category: "Nöje", interval_months: 12, anchor_month: 8 }),
];

const RANGES = [30, 90, 365];

describe("fasta utgifter i diagram vs detaljvy", () => {
  for (const days of RANGES) {
    it(`ger samma kategorisumma för ${days} dagar`, () => {
      const slices = spendSlices(spends, fixed, days, true, NOW);
      expect(slices.length).toBeGreaterThan(0);

      for (const slice of slices) {
        const detail = categoryBreakdown(slice.name, spends, fixed, days, NOW);
        expect(Math.round(detail.total)).toBe(slice.value);
      }
    });

    it(`totalen i diagrammet matchar summan av alla detaljvyer (${days} dagar)`, () => {
      const slices = spendSlices(spends, fixed, days, true, NOW);
      const chartTotal = slices.reduce((sum, s) => sum + s.value, 0);
      const detailTotal = slices.reduce(
        (sum, s) => sum + categoryBreakdown(s.name, spends, fixed, days, NOW).total,
        0,
      );
      expect(Math.round(detailTotal)).toBe(chartTotal);
    });
  }

  it("utan fasta utgifter matchar diagrammet detaljvyns köpsumma", () => {
    const slices = spendSlices(spends, fixed, 90, false, NOW);
    for (const slice of slices) {
      const detail = categoryBreakdown(slice.name, spends, fixed, 90, NOW);
      expect(Math.round(detail.spendTotal)).toBe(slice.value);
    }
  });

  it("räknar inaktiva fasta utgifter i varken diagram eller detaljvy", () => {
    const slices = spendSlices([], fixed, 365, true, NOW);
    expect(slices.find((s) => s.name === "Mat")).toBeUndefined();
    expect(categoryBreakdown("Mat", [], fixed, 365, NOW).fixedTotal).toBe(0);
  });
});

describe("fixedAmountInWindow", () => {
  it("räknar månadsposter en gång per kalendermånad i fönstret", () => {
    const hyra = fixed[0]!;
    // 30-dagarsfönstret 27 juli–26 aug träffar två förfallomånader.
    expect(fixedAmountInWindow(hyra, 30, NOW)).toBe(9000 * 2);
    expect(fixedAmountInWindow(hyra, 10, NOW)).toBe(9000);
    expect(fixedAmountInWindow(hyra, 365, NOW)).toBe(9000 * 13);
  });

  it("räknar kvartalsposter bara på faktiska förfallomånader", () => {
    const forsakring = fixed[1]!;
    const year = fixedAmountInWindow(forsakring, 365, NOW);
    expect(year % 1200).toBe(0);
    expect(year / 1200).toBeLessThanOrEqual(5);
  });

  it("räknar inte poster före deras startmånad", () => {
    const ny = fixedExpense({ name: "Ny", amount: 300, created_at: "2026-08-01T00:00:00Z" });
    expect(fixedAmountInWindow(ny, 365, NOW)).toBe(300);
  });
});

describe("månadsfönstret matchar Spenderat i mån.", () => {
  it("ger samma total som summan av månadens köp, utan fasta utgifter", () => {
    const days = monthToDateDays(NOW);
    const slices = spendSlices(spends, fixed, days, false, NOW);
    const chartTotal = slices.reduce((sum, s) => sum + s.value, 0);
    expect(chartTotal).toBe(Math.round(monthToDateSpend(spends, NOW)));
  });

  it("utesluter köp från föregående månad", () => {
    const days = monthToDateDays(NOW);
    const detail = categoryBreakdown("Mat", spends, fixed, days, NOW);
    expect(detail.rows.every((r) => r.spent_at.startsWith("2026-08"))).toBe(true);
  });
});

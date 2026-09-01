import { describe, expect, it } from "vitest";

import type { IncomeRow, SpendRow } from "@/lib/finance";
import type { FixedPaymentRow } from "@/lib/fixed-expenses";
import { monthOf, monthPrefix, monthSummary, shiftMonth } from "@/lib/month-summary";

const KEY = { year: 2026, month: 8 }; // september 2026

function spend(amount: number, spent_at: string, category?: string): SpendRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    amount,
    spent_at,
    category: category ?? null,
    note: null,
    account_id: null,
  } as unknown as SpendRow;
}

function income(
  amount: number,
  expected_on: string,
  is_received = true,
  received_on: string | null = null,
): IncomeRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    label: "Lön",
    kind: "lon",
    amount,
    expected_on,
    is_received,
    received_on,
    account_id: null,
  } as unknown as IncomeRow;
}

function payment(amount: number, paid_on: string): FixedPaymentRow {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    expense_id: "e",
    period: paid_on.slice(0, 7),
    paid_on,
    amount,
    source: "manuell",
  } as unknown as FixedPaymentRow;
}

describe("monthSummary", () => {
  it("summerar in, ut och netto för vald månad", () => {
    const res = monthSummary(
      KEY,
      [spend(200, "2026-09-03T10:00:00+02:00", "Mat"), spend(100, "2026-08-30T10:00:00+02:00")],
      [income(30000, "2026-09-25"), income(1000, "2026-09-10", false)],
      [payment(5000, "2026-09-01"), payment(500, "2026-08-01")],
    );

    expect(res.income).toBe(30000);
    expect(res.spent).toBe(200);
    expect(res.fixedPaid).toBe(5000);
    expect(res.net).toBe(24800);
    expect(res.byCategory).toEqual([{ name: "Mat", value: 200 }]);
  });

  it("räknar inbetalningen på faktiskt mottaget datum", () => {
    const res = monthSummary(KEY, [], [income(500, "2026-08-25", true, "2026-09-02")], []);
    expect(res.income).toBe(500);
    expect(res.byDay[1]?.in).toBe(500);
  });

  it("har en dagsserie som täcker hela månaden", () => {
    const res = monthSummary(KEY, [], [], []);
    expect(res.byDay).toHaveLength(30);
  });
});

describe("månadsnycklar", () => {
  it("bläddrar över årsskiftet", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(monthPrefix({ year: 2026, month: 0 })).toBe("2026-01");
    expect(monthOf(new Date(2026, 4, 9))).toEqual({ year: 2026, month: 4 });
  });
});

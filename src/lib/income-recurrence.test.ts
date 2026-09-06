import { describe, expect, it } from "vitest";

import {
  addMonths,
  dateInMonth,
  detectRecurringIncomes,
  planIncomes,
} from "@/lib/income-recurrence";
import type { IncomeRow } from "@/lib/finance";

function income(label: string, date: string, amount: number): IncomeRow {
  return {
    id: `${label}-${date}`,
    user_id: "u",
    label,
    amount,
    expected_on: date,
    received_on: date,
    is_received: true,
    kind: "lon",
    account_id: null,
    note: null,
    category: null,
    loan_id: null,
    created_at: date,
    updated_at: date,
  } as unknown as IncomeRow;
}

describe("income-recurrence", () => {
  const now = new Date(2026, 8, 6); // september 2026

  it("hittar återkommande inbetalningar", () => {
    const rows = [
      income("Lön", "2026-07-25", 32000),
      income("Lön", "2026-08-25", 32500),
      income("Sålt soffa", "2026-08-11", 1500),
    ];
    const found = detectRecurringIncomes(rows, now);
    expect(found).toHaveLength(1);
    expect(found[0]?.label).toBe("Lön");
    expect(found[0]?.day).toBe(25);
  });

  it("planerar bara månader som saknas", () => {
    const rows = [income("Lön", "2026-07-25", 30000), income("Lön", "2026-08-25", 30000)];
    const planned = planIncomes(rows, detectRecurringIncomes(rows, now), ["2026-08", "2026-09"]);
    expect(planned.map((p) => p.expected_on)).toEqual(["2026-09-25"]);
    expect(planned[0]?.is_received).toBe(false);
  });

  it("klipper datum till månadens sista dag", () => {
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

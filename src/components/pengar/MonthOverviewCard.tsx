import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { incomeDate, kr, type IncomeRow, type SpendRow } from "@/lib/finance";
import type { FixedPaymentRow } from "@/lib/fixed-expenses";
import {
  monthLabel,
  monthOf,
  monthSummary,
  shiftMonth,
  type MonthKey,
} from "@/lib/month-summary";

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-[19px] font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** Månadens ekonomi: in, ut, netto och fördelning – med månadsväljare. */
export function MonthOverviewCard({
  spends,
  incomes,
  payments,
  className,
}: {
  spends: SpendRow[];
  incomes: IncomeRow[];
  payments: FixedPaymentRow[];
  className?: string;
}) {
  const [key, setKey] = useState<MonthKey>(() => monthOf());
  const summary = useMemo(
    () => monthSummary(key, spends, incomes, payments),
    [key, spends, incomes, payments],
  );

  const out = summary.spent + summary.fixedPaid;
  const max = Math.max(summary.income, out, 1);
  const bars = summary.byDay.filter((d) => d.in > 0 || d.out > 0).length;

  return (
    <SectionCard
      title="Månadsöversikt"
      icon={CalendarRange}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      {...(className ? { className } : {})}
      action={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Föregående månad"
            className="size-8"
            onClick={() => setKey((k) => shiftMonth(k, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[104px] text-center text-xs font-medium capitalize">
            {monthLabel(key)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Nästa månad"
            className="size-8"
            onClick={() => setKey((k) => shiftMonth(k, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="In" value={kr(summary.income)} tone="text-cat-ledig" />
        <Stat label="Ut" value={kr(out)} tone="text-destructive" />
        <Stat
          label="Netto"
          value={kr(summary.net)}
          tone={summary.net >= 0 ? "text-cat-ledig" : "text-destructive"}
        />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-[11px] text-muted-foreground">In</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-cat-ledig"
              style={{ width: `${(summary.income / max) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-[11px] text-muted-foreground">Ut</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-destructive"
              style={{ width: `${(out / max) * 100}%` }}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ut = {kr(summary.spent)} i köp och {kr(summary.fixedPaid)} i betalda fasta utgifter.
        </p>
      </div>

      {bars > 0 ? (
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.byDay} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value: number, name) => [kr(value), name === "in" ? "In" : "Ut"]}
                labelFormatter={(day) => `Dag ${day}`}
              />
              <Bar dataKey="in" fill="var(--cat-ledig)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga registrerade rörelser den här månaden ännu.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Inbetalningar</p>
          {summary.incomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga bokförda inbetalningar.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.incomes.slice(0, 6).map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {incomeDate(row).slice(5)}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-cat-ledig">
                    +{kr(Number(row.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Största kategorier</p>
          {summary.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga köp registrerade.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.byCategory.slice(0, 6).map((cat) => (
                <li
                  key={cat.name}
                  className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{kr(cat.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

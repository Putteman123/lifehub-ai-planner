import { PieChart as PieIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { SectionCard } from "@/components/SectionCard";
import { kr, type FixedExpenseRow, type SpendRow } from "@/lib/finance";

const COLORS = [
  "var(--chart-1)",
  "var(--cat-privat)",
  "var(--cat-iptv)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--cat-ledig)",
  "var(--cat-barn)",
  "var(--cat-natt)",
  "var(--chart-3)",
  "var(--chart-2)",
];

const RANGES = [
  { value: 30, label: "30 dagar" },
  { value: 90, label: "3 mån" },
  { value: 365, label: "12 mån" },
];

/** Tårtdiagram över vad pengarna går till, per kategori. */
export function SpendPieCard({
  spends,
  fixed,
}: {
  spends: SpendRow[];
  fixed: FixedExpenseRow[];
}) {
  const [days, setDays] = useState(30);
  const [withFixed, setWithFixed] = useState(true);

  const slices = useMemo(() => {
    const since = Date.now() - days * 86400000;
    const sums = new Map<string, number>();
    const add = (name: string, amount: number) => {
      if (!(amount > 0)) return;
      sums.set(name, (sums.get(name) ?? 0) + amount);
    };

    for (const row of spends) {
      if (new Date(row.spent_at).getTime() < since) continue;
      add((row.category ?? "").trim() || "Övrigt", Number(row.amount));
    }

    if (withFixed) {
      const months = days / 30.44;
      for (const row of fixed) {
        if (!row.is_active) continue;
        add((row.category ?? "").trim() || "Boende", Number(row.amount) * months);
      }
    }

    return [...sums.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [spends, fixed, days, withFixed]);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <SectionCard
      title="Vad pengarna går till"
      icon={PieIcon}
      accent="text-cat-privat"
      tint="bg-cat-privat/12"
      action={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                days === r.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Registrera några utgifter så visas fördelningen här.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s, i) => (
                    <Cell key={s.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [kr(value), name]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground">Totalt</span>
              <span className="font-display text-lg font-semibold">{kr(total)}</span>
            </div>
          </div>

          <ul className="space-y-1.5 self-center">
            {slices.slice(0, 8).map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {total ? Math.round((s.value / total) * 100) : 0} %
                </span>
                <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums">
                  {kr(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={withFixed}
          onChange={(e) => setWithFixed(e.target.checked)}
          className="size-3.5 accent-[var(--primary)]"
        />
        Räkna med fasta utgifter
      </label>
    </SectionCard>
  );
}

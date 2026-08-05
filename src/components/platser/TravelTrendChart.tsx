import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useVisits } from "@/lib/db";
import { isTravel, TRAVEL_MODES, visitMinutes, type TravelMode } from "@/lib/geo";

const DAYS = 180;

const MODE_COLORS: Record<TravelMode, string> = {
  bil: "var(--chart-1)",
  kollektivt: "var(--chart-2)",
  gang_cykel: "var(--chart-3)",
  okant: "var(--chart-4)",
};

type Metric = "km" | "trips" | "minutes";

const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: "km", label: "Sträcka", unit: "km" },
  { value: "trips", label: "Antal resor", unit: "st" },
  { value: "minutes", label: "Restid", unit: "min" },
];

function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // måndag = 0
  d.setDate(d.getDate() - day);
  return d;
}

/** Trend per färdsätt vecka för vecka. */
export function TravelTrendChart() {
  const [metric, setMetric] = useState<Metric>("km");
  const sinceIso = useMemo(
    () => new Date(Date.now() - DAYS * 86400000).toISOString(),
    [],
  );
  const visitsQ = useVisits(sinceIso);

  const { data, activeModes } = useMemo(() => {
    const rows = (visitsQ.data ?? []).filter(isTravel);
    const buckets = new Map<number, Record<string, number>>();
    const used = new Set<TravelMode>();

    // Skapa tomma veckor så grafen blir sammanhängande.
    const first = weekStart(new Date(Date.now() - DAYS * 86400000));
    const last = weekStart(new Date());
    for (let t = first.getTime(); t <= last.getTime(); t += 7 * 86400000) {
      buckets.set(t, {});
    }

    for (const visit of rows) {
      const key = weekStart(new Date(visit.arrived_at)).getTime();
      const bucket = buckets.get(key) ?? {};
      const mode: TravelMode = visit.travel_mode ?? "okant";
      used.add(mode);
      const value =
        metric === "km"
          ? (visit.distance_m ?? 0) / 1000
          : metric === "minutes"
            ? visitMinutes(visit)
            : 1;
      bucket[mode] = (bucket[mode] ?? 0) + value;
      buckets.set(key, bucket);
    }

    const modes = TRAVEL_MODES.filter((m) => used.has(m.value));
    const points = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, values]) => {
        const point: Record<string, number | string> = {
          label: new Date(time).toLocaleDateString("sv-SE", {
            day: "numeric",
            month: "short",
          }),
        };
        for (const m of modes) {
          point[m.value] = Math.round((values[m.value] ?? 0) * 10) / 10;
        }
        return point;
      });

    return { data: points, activeModes: modes };
  }, [visitsQ.data, metric]);

  const unit = METRICS.find((m) => m.value === metric)?.unit ?? "";

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Trend per färdsätt</h2>
          <p className="text-xs text-muted-foreground">Vecka för vecka, senaste 6 månaderna</p>
        </div>
        <div className="flex rounded-lg border border-border/60 p-0.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMetric(m.value)}
              className={`rounded-md px-2 py-1 text-xs transition ${
                metric === m.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {activeModes.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Inga resor registrerade ännu – trenden visas när du loggat några resor.
        </p>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                {activeModes.map((m) => (
                  <linearGradient key={m.value} id={`trend-${m.value}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MODE_COLORS[m.value]} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={MODE_COLORS[m.value]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(value: number, name: string) => [
                  `${value} ${unit}`,
                  TRAVEL_MODES.find((m) => m.value === name)?.label ?? name,
                ]}
              />
              <Legend
                formatter={(name: string) =>
                  TRAVEL_MODES.find((m) => m.value === name)?.label ?? name
                }
                wrapperStyle={{ fontSize: 11 }}
              />
              {activeModes.map((m) => (
                <Area
                  key={m.value}
                  type="monotone"
                  dataKey={m.value}
                  stackId="1"
                  stroke={MODE_COLORS[m.value]}
                  fill={`url(#trend-${m.value})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

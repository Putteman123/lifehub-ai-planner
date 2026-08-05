import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

import { usePlaces, useVisits } from "@/lib/db";
import { isTravel, TRAVEL_MODES, visitMinutes, type TravelMode } from "@/lib/geo";
import { getTravelTrendInsight } from "@/lib/travel-insight.functions";
import { buildTrendStats, summarizeTrend, type TrendStat } from "@/lib/travel-trend";

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
  const placesQ = usePlaces();

  const stats = useMemo(
    () => buildTrendStats(visitsQ.data ?? [], placesQ.data ?? []),
    [visitsQ.data, placesQ.data],
  );

  const fetchInsight = useServerFn(getTravelTrendInsight);
  const insight = useMutation({
    mutationFn: () => fetchInsight({ data: { summary: summarizeTrend(stats) } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const analyzable = stats.filter((s) => s.enoughData);

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
        <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!analyzable.length || insight.isPending}
          onClick={() => insight.mutate()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {insight.isPending ? "Andrea tänker…" : "Analysera trenden"}
        </button>
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

      {stats.length > 0 && (insight.data || insight.isPending) ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {stats.map((stat) => (
            <TrendInsightCard
              key={stat.mode}
              stat={stat}
              text={insight.data?.insights.find((i) => i.mode === stat.mode) ?? null}
              loading={insight.isPending}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TrendInsightCard({
  stat,
  text,
  loading,
}: {
  stat: TrendStat;
  text: { headline: string; why: string; action: string } | null;
  loading: boolean;
}) {
  const Icon =
    stat.direction === "ökar" ? ArrowUpRight : stat.direction === "minskar" ? ArrowDownRight : ArrowRight;
  const tone =
    stat.direction === "ökar"
      ? "text-cat-viktigt"
      : stat.direction === "minskar"
        ? "text-cat-ledig"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: MODE_COLORS[stat.mode] }}
          />
          <span className="truncate">{stat.label}</span>
        </p>
        <span className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-medium ${tone}`}>
          <Icon className="size-3.5" />
          {stat.deltaKmPct == null ? "ny" : `${stat.deltaKmPct > 0 ? "+" : ""}${stat.deltaKmPct}%`}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {stat.recentKm} km senaste 4 v · {stat.previousKm} km innan · {stat.trips} resor totalt
      </p>

      {!stat.enoughData ? (
        <p className="mt-2 text-xs text-muted-foreground">För få resor för analys.</p>
      ) : text ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium">{text.headline}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{text.why}</p>
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Åtgärd: </span>
            {text.action}
          </p>
        </div>
      ) : loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Analyserar…</p>
      ) : null}
    </div>
  );
}

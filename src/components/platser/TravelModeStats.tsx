import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Bus, Car, HelpCircle, Sparkles, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useVisits } from "@/lib/db";
import {
  formatDistance,
  formatDuration,
  isTravel,
  TRAVEL_MODES,
  visitMinutes,
  type TravelMode,
} from "@/lib/geo";
import { getTravelInsight } from "@/lib/travel-insight.functions";


const DAYS = 90;

export const MODE_ICONS: Record<TravelMode, LucideIcon> = {
  bil: Car,
  kollektivt: Bus,
  gang_cykel: Bike,
  okant: HelpCircle,
};

/** Statistik per färdsätt de senaste 90 dagarna. */
export function TravelModeStats() {
  const sinceIso = useMemo(
    () => new Date(Date.now() - DAYS * 86400000).toISOString(),
    [],
  );
  const visitsQ = useVisits(sinceIso);

  const stats = useMemo(() => {
    const rows = (visitsQ.data ?? []).filter(isTravel);
    const totals = new Map<TravelMode, { trips: number; meters: number; minutes: number }>();
    for (const visit of rows) {
      const mode: TravelMode = visit.travel_mode ?? "okant";
      const current = totals.get(mode) ?? { trips: 0, meters: 0, minutes: 0 };
      totals.set(mode, {
        trips: current.trips + 1,
        meters: current.meters + (visit.distance_m ?? 0),
        minutes: current.minutes + visitMinutes(visit),
      });
    }
    return TRAVEL_MODES.map((m) => ({
      ...m,
      ...(totals.get(m.value) ?? { trips: 0, meters: 0, minutes: 0 }),
    })).filter((m) => m.trips > 0);
  }, [visitsQ.data]);

  const totalMeters = stats.reduce((sum, s) => sum + s.meters, 0);

  const fetchInsight = useServerFn(getTravelInsight);
  const insight = useMutation({
    mutationFn: () =>
      fetchInsight({
        data: {
          modes: stats.map((s) => ({
            label: s.label,
            trips: s.trips,
            km: s.meters / 1000,
            minutes: s.minutes,
          })),
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });



  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Bus className="size-4" /> Statistik per färdsätt
        </h2>
        <span className="text-xs text-muted-foreground">Senaste {DAYS} dagarna</span>
      </div>

      {stats.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga resor registrerade än.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {stats.map((s) => {
            const Icon = MODE_ICONS[s.value];
            const share = totalMeters ? Math.round((s.meters / totalMeters) * 100) : 0;
            return (
              <li
                key={s.value}
                className="rounded-xl border border-border/60 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {s.label}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {share}%
                  </span>
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {s.trips} resor · {formatDistance(s.meters)} ·{" "}
                  {formatDuration(s.minutes)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {stats.length > 0 ? (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" /> Andreas reseinsikt
            </span>
            <button
              type="button"
              onClick={() => insight.mutate()}
              disabled={insight.isPending}
              className="rounded-lg border border-border/60 px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
            >
              {insight.isPending
                ? "Analyserar…"
                : insight.data?.text
                  ? "Uppdatera"
                  : "Skapa insikt"}
            </button>
          </div>
          {insight.data?.text ? (
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {insight.data.text}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Låt Andrea sammanfatta dina färdsätt och föreslå hur du kan optimera resorna.
            </p>
          )}
        </div>
      ) : null}
    </section>

  );
}

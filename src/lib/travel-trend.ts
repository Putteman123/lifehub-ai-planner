import {
  isTravel,
  TRAVEL_MODES,
  travelModeLabel,
  visitMinutes,
  type PlaceRow,
  type TravelMode,
  type VisitRow,
} from "./geo";
import { endpointKey, WEEKDAYS, weekdayIndex } from "./route-key";

export type TrendDirection = "ökar" | "minskar" | "stabil";

export type TrendStat = {
  mode: TravelMode;
  label: string;
  trips: number;
  km: number;
  minutes: number;
  recentKm: number;
  previousKm: number;
  recentTrips: number;
  previousTrips: number;
  recentMinutes: number;
  previousMinutes: number;
  deltaKmPct: number | null;
  deltaTripsPct: number | null;
  deltaMinutesPct: number | null;
  direction: TrendDirection;
  avgKmPerTrip: number;
  topRoutes: { route: string; trips: number }[];
  weekdayShare: number;
  recentWeekdayShare: number;
  topWeekday: string | null;
  peakWeek: { label: string; km: number } | null;
  quietWeek: { label: string; km: number } | null;
  enoughData: boolean;
};

export type TrendPreference = {
  kind: string;
  route_key: string | null;
  weekday: number | null;
  preferred_mode: TravelMode;
};

export const MIN_TRIPS_FOR_INSIGHT = 3;
const WINDOW_DAYS = 28;

/** Måndag som veckostart (samma logik som trendgrafen). */
export function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekdayIndex(d));
  return d;
}

function pct(recent: number, previous: number): number | null {
  if (previous <= 0) return recent > 0 ? 100 : null;
  return Math.round(((recent - previous) / previous) * 100);
}

function weekLabel(time: number) {
  return new Date(time).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

/** Nyckeltal per färdsätt: senaste 4 veckorna mot de 4 veckorna innan. */
export function buildTrendStats(visits: VisitRow[], places: PlaceRow[] = []): TrendStat[] {
  const now = Date.now();
  const recentFrom = now - WINDOW_DAYS * 86400000;
  const previousFrom = now - 2 * WINDOW_DAYS * 86400000;
  const trips = visits.filter(isTravel);

  const stats: TrendStat[] = [];

  for (const { value: mode, label } of TRAVEL_MODES) {
    const rows = trips.filter((v) => (v.travel_mode ?? "okant") === mode);
    if (!rows.length) continue;

    let km = 0;
    let minutes = 0;
    let recentKm = 0;
    let previousKm = 0;
    let recentTrips = 0;
    let previousTrips = 0;
    let recentMinutes = 0;
    let previousMinutes = 0;
    let weekdayTrips = 0;
    let recentWeekdayTrips = 0;

    const routeCounts = new Map<string, number>();
    const weekdayCounts = new Map<number, number>();
    const weekKm = new Map<number, number>();

    for (const visit of rows) {
      const distanceKm = (visit.distance_m ?? 0) / 1000;
      const mins = visitMinutes(visit);
      const at = new Date(visit.arrived_at);
      const time = at.getTime();

      km += distanceKm;
      minutes += mins;

      const day = weekdayIndex(at);
      weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
      if (day < 5) weekdayTrips += 1;

      const week = weekStart(at).getTime();
      weekKm.set(week, Math.round(((weekKm.get(week) ?? 0) + distanceKm) * 10) / 10);

      const from = endpointKey(
        visit.lat != null && visit.lng != null ? { lat: visit.lat, lng: visit.lng } : null,
        places,
        "Okänd start",
      );
      const to = endpointKey(
        visit.end_lat != null && visit.end_lng != null
          ? { lat: visit.end_lat, lng: visit.end_lng }
          : null,
        places,
        visit.label ?? "Okänt mål",
      );
      const route = `${from} → ${to}`;
      routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);

      if (time >= recentFrom) {
        recentKm += distanceKm;
        recentTrips += 1;
        recentMinutes += mins;
        if (day < 5) recentWeekdayTrips += 1;
      } else if (time >= previousFrom) {
        previousKm += distanceKm;
        previousTrips += 1;
        previousMinutes += mins;
      }
    }

    const deltaKmPct = pct(recentKm, previousKm);
    const direction: TrendDirection =
      deltaKmPct == null || Math.abs(deltaKmPct) < 15
        ? "stabil"
        : deltaKmPct > 0
          ? "ökar"
          : "minskar";

    const weeks = [...weekKm.entries()].sort((a, b) => b[1] - a[1]);
    const topWeekdayEntry = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    stats.push({
      mode,
      label,
      trips: rows.length,
      km: Math.round(km * 10) / 10,
      minutes: Math.round(minutes),
      recentKm: Math.round(recentKm * 10) / 10,
      previousKm: Math.round(previousKm * 10) / 10,
      recentTrips,
      previousTrips,
      recentMinutes: Math.round(recentMinutes),
      previousMinutes: Math.round(previousMinutes),
      deltaKmPct,
      deltaTripsPct: pct(recentTrips, previousTrips),
      deltaMinutesPct: pct(recentMinutes, previousMinutes),
      direction,
      avgKmPerTrip: Math.round((km / rows.length) * 10) / 10,
      topRoutes: [...routeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([route, count]) => ({ route, trips: count })),
      weekdayShare: Math.round((weekdayTrips / rows.length) * 100),
      recentWeekdayShare: recentTrips
        ? Math.round((recentWeekdayTrips / recentTrips) * 100)
        : 0,
      topWeekday: topWeekdayEntry ? (WEEKDAYS[topWeekdayEntry[0]] ?? null) : null,
      peakWeek: weeks[0] ? { label: weekLabel(weeks[0][0]), km: weeks[0][1] } : null,
      quietWeek: weeks.length > 1 ? { label: weekLabel(weeks[weeks.length - 1]![0]), km: weeks[weeks.length - 1]![1] } : null,
      enoughData: rows.length >= MIN_TRIPS_FOR_INSIGHT,
    });
  }

  return stats.sort((a, b) => b.km - a.km);
}

/** Kompakt textunderlag per färdsätt för AI-prompten. */
export function summarizeTrend(stats: TrendStat[], preferences: TrendPreference[] = []) {
  const lines = stats
    .filter((s) => s.enoughData)
    .map((s) => {
      const delta = (value: number | null) => (value == null ? "ingen jämförelse" : `${value > 0 ? "+" : ""}${value}%`);
      const routes = s.topRoutes.map((r) => `${r.route} (${r.trips}st)`).join("; ") || "inga tydliga rutter";
      return [
        `[${s.mode}] ${s.label}`,
        `totalt ${s.trips} resor, ${s.km} km, ${s.minutes} min, snitt ${s.avgKmPerTrip} km/resa`,
        `senaste 4 v: ${s.recentTrips} resor / ${s.recentKm} km / ${s.recentMinutes} min`,
        `föregående 4 v: ${s.previousTrips} resor / ${s.previousKm} km / ${s.previousMinutes} min`,
        `förändring sträcka ${delta(s.deltaKmPct)}, antal ${delta(s.deltaTripsPct)}, restid ${delta(s.deltaMinutesPct)} (${s.direction})`,
        `vardagsandel totalt ${s.weekdayShare}%, senaste 4 v ${s.recentWeekdayShare}%, vanligast ${s.topWeekday ?? "okänt"}`,
        `toppvecka ${s.peakWeek ? `${s.peakWeek.label} (${s.peakWeek.km} km)` : "-"}, tystaste ${s.quietWeek ? `${s.quietWeek.label} (${s.quietWeek.km} km)` : "-"}`,
        `vanligaste rutter: ${routes}`,
      ].join(" | ");
    });

  const prefLines = preferences.map((p) =>
    p.kind === "rutt"
      ? `Preferens rutt ${p.route_key}: ${travelModeLabel(p.preferred_mode)}`
      : `Preferens ${WEEKDAYS[p.weekday ?? 0] ?? "veckodag"}: ${travelModeLabel(p.preferred_mode)}`,
  );

  return [...lines, ...prefLines].join("\n");
}

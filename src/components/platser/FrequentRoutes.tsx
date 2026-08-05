import { Repeat, ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { useVisits } from "@/lib/db";
import {
  formatDistance,
  formatDuration,
  isTravel,
  visitMinutes,
  type PlaceRow,
  type VisitRow,
} from "@/lib/geo";

const DAYS = 90;

/** Namnger en punkt efter närmaste sparade plats, annars grovt rutnät. */
function endpointKey(
  point: { lat: number; lng: number } | null,
  places: PlaceRow[],
  fallback: string,
) {
  if (!point) return fallback;
  let best: { name: string; distance: number } | null = null;
  for (const place of places) {
    const dLat = (place.lat - point.lat) * 111320;
    const dLng = (place.lng - point.lng) * 111320 * Math.cos((point.lat * Math.PI) / 180);
    const distance = Math.hypot(dLat, dLng);
    if (distance <= Math.max(place.radius_m, 200) && (!best || distance < best.distance)) {
      best = { name: place.name, distance };
    }
  }
  if (best) return best.name;
  // Gruppera okända punkter i ~500 m rutor så återkommande resvägar ändå matchar.
  return `Okänd plats (${point.lat.toFixed(2)}, ${point.lng.toFixed(2)})`;
}

type Route = {
  key: string;
  from: string;
  to: string;
  count: number;
  avgMinutes: number;
  avgMeters: number;
  lastAt: string;
};

function buildRoutes(visits: VisitRow[], places: PlaceRow[]): Route[] {
  const map = new Map<string, { from: string; to: string; minutes: number[]; meters: number[]; last: string }>();

  for (const visit of visits.filter(isTravel)) {
    const start = visit.lat != null && visit.lng != null ? { lat: visit.lat, lng: visit.lng } : null;
    const end =
      visit.end_lat != null && visit.end_lng != null
        ? { lat: visit.end_lat, lng: visit.end_lng }
        : null;
    if (!start || !end) continue;

    const from = endpointKey(start, places, "Okänd start");
    const to = endpointKey(end, places, "Okänt mål");
    const key = `${from}→${to}`;
    const entry = map.get(key) ?? { from, to, minutes: [], meters: [], last: visit.arrived_at };
    entry.minutes.push(visitMinutes(visit));
    entry.meters.push(visit.distance_m ?? 0);
    if (visit.arrived_at > entry.last) entry.last = visit.arrived_at;
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([key, e]) => ({
      key,
      from: e.from,
      to: e.to,
      count: e.minutes.length,
      avgMinutes: e.minutes.reduce((a, b) => a + b, 0) / e.minutes.length,
      avgMeters: e.meters.reduce((a, b) => a + b, 0) / e.meters.length,
      lastAt: e.last,
    }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, 8);
}

/** Topplista över återkommande resvägar med snittid. */
export function FrequentRoutes({ places }: { places: PlaceRow[] }) {
  const sinceIso = useMemo(() => new Date(Date.now() - DAYS * 86400000).toISOString(), []);
  const visitsQ = useVisits(sinceIso);
  const routes = useMemo(
    () => buildRoutes(visitsQ.data ?? [], places),
    [visitsQ.data, places],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Repeat className="size-4" /> Mina vanligaste resvägar
        </h2>
        <span className="text-xs text-muted-foreground">Senaste {DAYS} dagarna</span>
      </div>

      {routes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga återkommande resvägar än – de dyker upp när samma sträcka loggats minst två gånger.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {routes.map((route) => (
            <li
              key={route.key}
              className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{route.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{route.to}</span>
                </span>
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums">
                <span className="block font-medium">{formatDuration(Math.round(route.avgMinutes))} i snitt</span>
                <span className="block text-muted-foreground">
                  {route.count} resor · {formatDistance(route.avgMeters)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

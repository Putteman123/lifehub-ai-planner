import type { Tables } from "@/integrations/supabase/types";

export type PlaceRow = Tables<"places">;
export type VisitRow = Tables<"visits">;
export type PingRow = Tables<"location_pings">;

export type PlaceKind = PlaceRow["kind"];

export const PLACE_KINDS: { value: PlaceKind; label: string; color: string }[] = [
  { value: "jobb", label: "Jobb", color: "#3b82f6" },
  { value: "jurist", label: "Jurist", color: "#f97316" },
  { value: "hem", label: "Hem", color: "#8b5cf6" },
  { value: "barn", label: "Barn", color: "#eab308" },
  { value: "annat", label: "Annat", color: "#64748b" },
];

export function kindLabel(kind: PlaceKind) {
  return PLACE_KINDS.find((k) => k.value === kind)?.label ?? "Annat";
}

/** Avstånd mellan två koordinater i meter. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Närmaste plats vars radie täcker punkten, annars null. */
export function matchPlace<T extends { lat: number; lng: number; radius_m: number }>(
  places: T[],
  lat: number,
  lng: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const place of places) {
    const distance = haversineMeters(lat, lng, place.lat, place.lng);
    if (distance <= place.radius_m && distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

/** Besökets längd i minuter (öppet besök räknas fram till nu). */
export function visitMinutes(visit: Pick<VisitRow, "arrived_at" | "left_at">, now = new Date()) {
  const start = new Date(visit.arrived_at).getTime();
  const end = visit.left_at ? new Date(visit.left_at).getTime() : now.getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Överlappande minuter mellan ett besök och ett tidsintervall. */
export function overlapMinutes(
  visit: Pick<VisitRow, "arrived_at" | "left_at">,
  from: Date,
  to: Date,
  now = new Date(),
) {
  const start = Math.max(new Date(visit.arrived_at).getTime(), from.getTime());
  const end = Math.min(
    visit.left_at ? new Date(visit.left_at).getTime() : now.getTime(),
    to.getTime(),
  );
  return Math.max(0, Math.round((end - start) / 60000));
}

/** Summerar minuter per platstyp inom ett intervall (resor räknas inte). */
export function minutesByKind(
  visits: VisitRow[],
  places: PlaceRow[],
  from: Date,
  to: Date,
  now = new Date(),
): Record<PlaceKind, number> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const totals: Record<PlaceKind, number> = {
    jobb: 0,
    jurist: 0,
    hem: 0,
    barn: 0,
    annat: 0,
  };
  for (const visit of visits) {
    if (isTravel(visit)) continue;
    const minutes = overlapMinutes(visit, from, to, now);
    if (!minutes) continue;
    const kind = (visit.place_id ? byId.get(visit.place_id)?.kind : undefined) ?? "annat";
    totals[kind] += minutes;
  }
  return totals;
}

/** Hastighetsgräns då förflyttning tolkas som resa (~8 km/h). */
export const TRAVEL_SPEED_MS = 2.2;
/** Kortare resor än så här kastas. */
export const MIN_TRAVEL_METERS = 500;
export const MIN_TRAVEL_MINUTES = 3;

export function isTravel(visit: Pick<VisitRow, "entry_kind">) {
  return visit.entry_kind === "resa";
}

export function formatDistance(meters: number) {
  if (!meters || meters < 0) return "0 km";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`.replace(".", ",");
}

/** Restid och sträcka inom ett intervall. */
export function travelStats(visits: VisitRow[], from: Date, to: Date, now = new Date()) {
  let minutes = 0;
  let meters = 0;
  let count = 0;
  for (const visit of visits) {
    if (!isTravel(visit)) continue;
    const overlap = overlapMinutes(visit, from, to, now);
    if (!overlap) continue;
    const total = visitMinutes(visit, now) || 1;
    minutes += overlap;
    meters += (visit.distance_m ?? 0) * (overlap / total);
    count += 1;
  }
  return { minutes, meters, count };
}

export type PlaceStat = {
  key: string;
  name: string;
  kind: PlaceKind;
  color: string;
  visits: number;
  minutes: number;
};

/** Topplista: antal besök och total tid per plats inom ett intervall. */
export function placeTotals(
  visits: VisitRow[],
  places: PlaceRow[],
  from: Date,
  to: Date,
  now = new Date(),
): PlaceStat[] {
  const byId = new Map(places.map((p) => [p.id, p]));
  const stats = new Map<string, PlaceStat>();

  for (const visit of visits) {
    if (isTravel(visit)) continue;
    const minutes = overlapMinutes(visit, from, to, now);
    if (!minutes) continue;
    const place = visit.place_id ? byId.get(visit.place_id) : undefined;
    const name = place?.name ?? visit.label ?? "Okänd plats";
    const key = place?.id ?? `label:${name}`;
    const current =
      stats.get(key) ??
      ({
        key,
        name,
        kind: place?.kind ?? "annat",
        color: place?.color ?? "#64748b",
        visits: 0,
        minutes: 0,
      } satisfies PlaceStat);
    current.visits += 1;
    current.minutes += minutes;
    stats.set(key, current);
  }

  return [...stats.values()].sort(
    (a, b) => b.visits - a.visits || b.minutes - a.minutes,
  );
}

export function visitLabel(visit: VisitRow, places: PlaceRow[]) {
  if (isTravel(visit)) return visit.label ?? "Resa";
  if (visit.place_id) {
    const place = places.find((p) => p.id === visit.place_id);
    if (place) return place.name;
  }
  return visit.label ?? "Okänd plats";
}


export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Måndag som veckostart. */
export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

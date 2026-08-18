import { isTravel, visitMinutes, type PlaceRow, type VisitRow } from "@/lib/geo";

/** En rad i dagsloggen: ett besök eller en resa, klippt mot det valda dygnet. */
export type DayEntry = {
  /** Källposten (den första om flera slagits ihop i vyn). */
  visit: VisitRow;
  /** Övriga poster som slagits ihop i vyn. */
  merged: VisitRow[];
  /** Start inom dygnet. */
  from: Date;
  /** Slut inom dygnet (nu om besöket pågår). */
  to: Date;
  /** Startade före dygnets början. */
  startsEarlier: boolean;
  /** Pågår efter dygnets slut (eller är fortfarande öppet). */
  continues: boolean;
  /** Öppet besök utan sluttid. */
  open: boolean;
  minutes: number;
  meters: number;
  travel: boolean;
};

export function startOfDayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayFromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function shiftDay(key: string, days: number) {
  const d = dayFromKey(key);
  d.setDate(d.getDate() + days);
  return startOfDayKey(d);
}

export function dayTitle(key: string, today = new Date()) {
  const d = dayFromKey(key);
  const diff = Math.round(
    (d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  if (diff === 0) return "I dag";
  if (diff === -1) return "I går";
  if (diff === 1) return "I morgon";
  return d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
}

export function shortDayTime(date: Date) {
  return date.toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function endOf(visit: VisitRow, now: Date) {
  return visit.left_at ? new Date(visit.left_at) : now;
}

/** Poster som överlappar dygnet – inte bara de som slutade den dagen. */
export function visitsForDay(visits: VisitRow[], dayKey: string, now = new Date()) {
  const start = dayFromKey(dayKey);
  const end = new Date(start.getTime() + 86400000);
  return visits
    .filter((v) => {
      const from = new Date(v.arrived_at);
      const to = endOf(v, now);
      return from < end && to > start;
    })
    .sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
}

/** Är två poster samma plats (eller samma fritextnamn)? */
function samePlace(a: VisitRow, b: VisitRow) {
  if (isTravel(a) || isTravel(b)) return false;
  if (a.place_id && b.place_id) return a.place_id === b.place_id;
  if (!a.place_id && !b.place_id) {
    const la = (a.label ?? "").trim().toLowerCase();
    const lb = (b.label ?? "").trim().toLowerCase();
    return la !== "" && la === lb;
  }
  return false;
}

/**
 * Bygger dagens rader: klipper mot dygnet, slår ihop intilliggande poster på
 * samma plats (max 15 minuters glapp) och räknar tid inom dygnet.
 */
export function buildDayEntries(visits: VisitRow[], dayKey: string, now = new Date()): DayEntry[] {
  const dayStart = dayFromKey(dayKey);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const rows = visitsForDay(visits, dayKey, now);

  const groups: VisitRow[][] = [];
  for (const visit of rows) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      samePlace(prev, visit) &&
      new Date(visit.arrived_at).getTime() - endOf(prev, now).getTime() <= 15 * 60000
    ) {
      last!.push(visit);
    } else {
      groups.push([visit]);
    }
  }

  return groups.map((group) => {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    const rawFrom = new Date(first.arrived_at);
    const rawTo = endOf(last, now);
    const from = rawFrom < dayStart ? dayStart : rawFrom;
    const to = rawTo > dayEnd ? dayEnd : rawTo;
    return {
      visit: first,
      merged: group.slice(1),
      from,
      to,
      startsEarlier: rawFrom < dayStart,
      continues: rawTo > dayEnd,
      open: !last.left_at,
      minutes: Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000)),
      meters: group.reduce((sum, v) => sum + (v.distance_m ?? 0), 0),
      travel: isTravel(first),
    };
  });
}

/** Småposter som mest skräpar ner loggen. */
export function isNoise(entry: DayEntry) {
  if (entry.travel) return entry.meters < 300;
  return entry.minutes < 5 && !entry.visit.is_manual && entry.visit.place_id == null;
}

export function daySummary(entries: DayEntry[], places: PlaceRow[]) {
  const stops = entries.filter((e) => !e.travel);
  const trips = entries.filter((e) => e.travel);
  const byKind: Record<string, number> = {};
  for (const entry of stops) {
    const place = places.find((p) => p.id === entry.visit.place_id);
    const kind = place?.kind ?? "annat";
    byKind[kind] = (byKind[kind] ?? 0) + entry.minutes;
  }
  return {
    stops: stops.length,
    trips: trips.length,
    meters: trips.reduce((sum, e) => sum + e.meters, 0),
    minutes: stops.reduce((sum, e) => sum + e.minutes, 0),
    byKind,
  };
}

/** Total tid för en post oavsett dygn (används i detaljvyer). */
export function totalMinutes(entry: DayEntry, now = new Date()) {
  return [entry.visit, ...entry.merged].reduce((sum, v) => sum + visitMinutes(v, now), 0);
}

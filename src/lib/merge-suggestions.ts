import type { VisitRow } from "@/lib/geo";

/** Max tidslucka mellan två delresor för att räknas som samma resa. */
const MAX_GAP_MIN = 120;
/** Max avstånd mellan slutpunkt och nästa startpunkt (meter). */
const MAX_LINK_M = 2500;

export type MergeSuggestion = {
  id: string;
  visitIds: string[];
  mode: VisitRow["travel_mode"];
  from: string;
  to: string;
  meters: number;
  minutes: number;
  gapMinutes: number;
};

function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * 111320;
  const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function endPoint(v: VisitRow) {
  return v.end_lat != null && v.end_lng != null ? { lat: v.end_lat, lng: v.end_lng } : null;
}
function startPoint(v: VisitRow) {
  return v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null;
}

function endTime(v: VisitRow) {
  return new Date(v.left_at ?? v.arrived_at).getTime();
}

/**
 * Föreslår grupper av resor som troligen är samma resa uppdelad i flera poster:
 * samma färdsätt, nära i tid och där slutpunkt/startpunkt hänger ihop geografiskt.
 */
export function suggestTravelMerges(
  visits: VisitRow[],
  nameFor: (point: { lat: number; lng: number } | null, fallback: string) => string,
): MergeSuggestion[] {
  const rows = [...visits].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
  const groups: VisitRow[][] = [];
  let current: VisitRow[] = [];
  let maxGap = 0;
  let groupGap = 0;

  const flush = () => {
    if (current.length >= 2) {
      groups.push(current);
      groupGap = maxGap;
      gaps.push(groupGap);
    }
    current = [];
    maxGap = 0;
  };
  const gaps: number[] = [];

  for (const visit of rows) {
    if (current.length === 0) {
      current = [visit];
      continue;
    }
    const prev = current[current.length - 1]!;
    const gapMin = (new Date(visit.arrived_at).getTime() - endTime(prev)) / 60000;
    const sameMode = (prev.travel_mode ?? "okant") === (visit.travel_mode ?? "okant");
    const prevEnd = endPoint(prev);
    const nextStart = startPoint(visit);
    const linked =
      !prevEnd || !nextStart ? true : metersBetween(prevEnd, nextStart) <= MAX_LINK_M;

    if (sameMode && linked && gapMin >= -5 && gapMin <= MAX_GAP_MIN) {
      maxGap = Math.max(maxGap, Math.round(Math.max(0, gapMin)));
      current.push(visit);
    } else {
      flush();
      current = [visit];
    }
  }
  flush();

  return groups.map((group, index) => {
    const first = group[0]!;
    const last = group[group.length - 1]!;
    return {
      id: `${first.id}-${group.length}`,
      visitIds: group.map((v) => v.id),
      mode: first.travel_mode,
      from: nameFor(startPoint(first), "Okänd start"),
      to: nameFor(endPoint(last), "Okänt mål"),
      meters: group.reduce((sum, v) => sum + (v.distance_m ?? 0), 0),
      minutes: Math.max(
        0,
        Math.round((endTime(last) - new Date(first.arrived_at).getTime()) / 60000),
      ),
      gapMinutes: gaps[index] ?? 0,
    };
  });
}

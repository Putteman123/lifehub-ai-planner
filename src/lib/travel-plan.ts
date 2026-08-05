import type { EventRow } from "./categories";
import {
  estimateRouteMeters,
  haversineMeters,
  isTravel,
  visitMinutes,
  type PlaceRow,
  type TravelMode,
  type VisitRow,
} from "./geo";
import { endpointKey, weekdayIndex } from "./route-key";

export type PreferenceRow = {
  kind: string;
  route_key: string | null;
  weekday: number | null;
  preferred_mode: TravelMode;
};

export type PlanStatus = "ok" | "tight" | "conflict";

export type TravelPlanItem = {
  eventId: string;
  title: string;
  startsAt: string;
  fromName: string;
  toName: string;
  routeKey: string;
  meters: number;
  minutes: number;
  /** Källa för restiden: historik, Google Maps eller uppskattning. */
  basis: "historik" | "google" | "uppskattad";
  /** Koordinater för sträckan, används för att hämta Google-rutt. */
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: TravelMode;
  modeSource: "preferens" | "historik" | "förslag";
  leaveAt: string;
  /** Tillgänglig tid mellan föregående aktivitet och avresa, null = fri förmiddag. */
  availableMinutes: number | null;
  marginMinutes: number | null;
  status: PlanStatus;
  previousTitle: string | null;
};

/** Nyckel för en sträcka mellan två koordinater. */
export function legKey(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}->${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
}

export type RouteLookup = Record<string, { meters: number; minutes: number } | null>;

/** Marginal i minuter som alltid läggs på restiden. */
export const BASE_BUFFER_MIN = 5;

/** Snitthastighet (km/h) och påstigningstid (min) per färdsätt. */
const MODE_MODEL: Record<TravelMode, { kmh: number; overhead: number }> = {
  bil: { kmh: 42, overhead: 5 },
  kollektivt: { kmh: 24, overhead: 12 },
  gang_cykel: { kmh: 13, overhead: 2 },
  okant: { kmh: 35, overhead: 5 },
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/** Matchar en händelses plats/titel mot en sparad plats. */
export function matchEventPlace(event: EventRow, places: PlaceRow[]): PlaceRow | null {
  const haystacks = [event.location, event.title]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map(normalize);
  if (!haystacks.length) return null;

  let best: { place: PlaceRow; score: number } | null = null;
  for (const place of places) {
    const candidates = [place.name, place.address].filter(
      (v): v is string => Boolean(v && v.trim()),
    );
    for (const candidate of candidates) {
      const needle = normalize(candidate);
      if (needle.length < 3) continue;
      for (const hay of haystacks) {
        if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
          const score = needle.length;
          if (!best || score > best.score) best = { place, score };
        }
      }
    }
  }
  return best?.place ?? null;
}

/** Historiskt snitt för en rutt: minuter, sträcka och vanligaste färdsätt. */
function historyForRoute(
  visits: VisitRow[],
  from: PlaceRow,
  to: PlaceRow,
): { minutes: number; meters: number; mode: TravelMode | null } | null {
  const matches = visits.filter((v) => {
    if (!isTravel(v)) return false;
    if (v.lat == null || v.lng == null || v.end_lat == null || v.end_lng == null) return false;
    const startOk = haversineMeters(v.lat, v.lng, from.lat, from.lng) <= Math.max(from.radius_m, 300);
    const endOk =
      haversineMeters(v.end_lat, v.end_lng, to.lat, to.lng) <= Math.max(to.radius_m, 300);
    return startOk && endOk;
  });
  if (!matches.length) return null;

  const minutes = matches.reduce((sum, v) => sum + visitMinutes(v), 0) / matches.length;
  const meters = matches.reduce((sum, v) => sum + (v.distance_m ?? 0), 0) / matches.length;

  const counts = new Map<TravelMode, number>();
  for (const v of matches) {
    const mode: TravelMode = v.travel_mode ?? "okant";
    if (mode === "okant") continue;
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { minutes: Math.max(1, Math.round(minutes)), meters: Math.round(meters), mode };
}

/** Väljer färdsätt: preferens > historik > avståndsförslag. */
function pickMode(
  routeKey: string,
  date: Date,
  prefs: PreferenceRow[],
  historyMode: TravelMode | null,
  meters: number,
): { mode: TravelMode; source: TravelPlanItem["modeSource"] } {
  const routePref = prefs.find((p) => p.kind === "rutt" && p.route_key === routeKey);
  if (routePref) return { mode: routePref.preferred_mode, source: "preferens" };

  const dayPref = prefs.find(
    (p) => p.kind === "veckodag" && p.weekday === weekdayIndex(date),
  );
  if (dayPref) return { mode: dayPref.preferred_mode, source: "preferens" };

  if (historyMode) return { mode: historyMode, source: "historik" };
  if (meters <= 2500) return { mode: "gang_cykel", source: "förslag" };
  return { mode: "bil", source: "förslag" };
}

function estimateMinutes(meters: number, mode: TravelMode) {
  const model = MODE_MODEL[mode] ?? MODE_MODEL.okant;
  return Math.max(1, Math.round((meters / 1000 / model.kmh) * 60 + model.overhead));
}

/** Startplats: föregående aktivitet samma dag, annars hemmaplatsen. */
function defaultOrigin(places: PlaceRow[]): PlaceRow | null {
  return places.find((p) => p.kind === "hem") ?? places[0] ?? null;
}

/**
 * Bygger en reseplan för kommande aktiviteter med plats: färdsätt, restid,
 * avresetid och marginal.
 */
export function buildTravelPlan(input: {
  events: EventRow[];
  places: PlaceRow[];
  visits: VisitRow[];
  preferences: PreferenceRow[];
  /** Verkliga sträckor från Google Maps, nyckel från legKey(). */
  routes?: RouteLookup;
  from?: Date;
  days?: number;
}): TravelPlanItem[] {
  const from = input.from ?? new Date();
  const days = input.days ?? 7;
  const until = new Date(from.getTime() + days * 86400000);
  const home = defaultOrigin(input.places);

  const upcoming = input.events
    .filter((e) => !e.all_day)
    .filter((e) => {
      const start = new Date(e.starts_at).getTime();
      return start >= from.getTime() && start <= until.getTime();
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const items: TravelPlanItem[] = [];

  for (let i = 0; i < upcoming.length; i += 1) {
    const event = upcoming[i]!;
    const destination = matchEventPlace(event, input.places);
    if (!destination) continue;

    const start = new Date(event.starts_at);

    // Föregående aktivitet samma dag ger startpunkten.
    const previous = [...upcoming.slice(0, i)]
      .reverse()
      .find((e) => new Date(e.starts_at).toDateString() === start.toDateString());
    const previousPlace = previous ? matchEventPlace(previous, input.places) : null;
    const origin = previousPlace ?? home;
    if (!origin || origin.id === destination.id) continue;

    const history = historyForRoute(input.visits, origin, destination);
    const google = input.routes?.[legKey(origin, destination)] ?? null;
    const meters =
      history?.meters && history.meters > 0
        ? history.meters
        : google?.meters
          ? google.meters
          : estimateRouteMeters(origin.lat, origin.lng, destination.lat, destination.lng);

    const routeKey = `${endpointKey({ lat: origin.lat, lng: origin.lng }, input.places, origin.name)}→${endpointKey(
      { lat: destination.lat, lng: destination.lng },
      input.places,
      destination.name,
    )}`;

    const { mode, source } = pickMode(
      routeKey,
      start,
      input.preferences,
      history?.mode ?? null,
      meters,
    );

    const minutes = history
      ? history.minutes
      : google?.minutes
        ? google.minutes
        : estimateMinutes(meters, mode);
    const basis: TravelPlanItem["basis"] = history
      ? "historik"
      : google
        ? "google"
        : "uppskattad";

    const leaveAt = new Date(start.getTime() - (minutes + BASE_BUFFER_MIN) * 60000);

    let availableMinutes: number | null = null;
    if (previous) {
      availableMinutes = Math.round(
        (start.getTime() - new Date(previous.ends_at).getTime()) / 60000,
      );
    }
    const marginMinutes =
      availableMinutes == null ? null : availableMinutes - minutes - BASE_BUFFER_MIN;

    let status: PlanStatus = "ok";
    if (marginMinutes != null) {
      if (marginMinutes < 0) status = "conflict";
      else if (marginMinutes < 10) status = "tight";
    }

    items.push({
      eventId: event.id,
      title: event.title,
      startsAt: event.starts_at,
      fromName: origin.name,
      toName: destination.name,
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      routeKey,
      meters,
      minutes,
      basis,
      mode,
      modeSource: source,
      leaveAt: leaveAt.toISOString(),
      availableMinutes,
      marginMinutes,
      status,
      previousTitle: previous?.title ?? null,
    });
  }

  return items;
}

/** Kompakt textsammanfattning av planen – underlag till Andrea. */
export function summarizePlan(items: TravelPlanItem[]) {
  return items
    .map((item) => {
      const when = new Date(item.startsAt).toLocaleString("sv-SE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const margin =
        item.marginMinutes == null
          ? "ingen tidigare aktivitet"
          : `${item.marginMinutes} min marginal`;
      return `${when} · ${item.title} · ${item.fromName}→${item.toName} · ${(
        item.meters / 1000
      ).toFixed(1)} km · ${item.mode} (${item.modeSource}) · ${item.minutes} min restid (${item.basis}) · ${margin} · status ${item.status}`;
    })
    .join("\n");
}

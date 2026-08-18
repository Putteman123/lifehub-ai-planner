/**
 * Väger samman flera signaler till ett färdsätt för en resa:
 * Google Routes (verklig sträcka/restid), Google Places kring start och slut
 * (stationer och hållplatser), samt kalenderns text för samma tidsfönster.
 * Ren logik utan nätverksanrop så den går att testa och köra var som helst.
 */
import { guessTravelMode, type TravelMode } from "@/lib/geo";

const TRANSIT_TYPES = [
  "transit_station",
  "train_station",
  "subway_station",
  "light_rail_station",
  "bus_station",
  "bus_stop",
];

const TRANSIT_WORDS = ["tåg", "buss", "pendel", "spårvagn", "tunnelbana", "kollektiv", "sl "];
const CAR_WORDS = ["kör", "bil", "parkering", "tanka"];
const WALK_WORDS = ["promenad", "gå ", "cykel", "cykla", "löprunda"];

export type NearbyLite = { name: string; meters: number; types: string[] };

export type TravelModeInput = {
  /** Sträcka i meter (helst Google Routes, annars uppmätt spår). */
  distanceM: number;
  /** Faktisk tid resan tog, i minuter. */
  minutesSpent: number;
  /** Google Routes-svar för bilrutten, om det finns. */
  route?: { meters: number; minutes: number } | null;
  nearbyStart?: NearbyLite[];
  nearbyEnd?: NearbyLite[];
  /** Kalendertexter som överlappar resan. */
  calendar?: string[];
};

export type TravelModeGuess = {
  mode: TravelMode;
  reason: string;
};

function hasTransit(list: NearbyLite[] | undefined) {
  return (list ?? []).some(
    (n) => n.meters <= 220 && n.types.some((t) => TRANSIT_TYPES.includes(t)),
  );
}

function textHit(texts: string[] | undefined, words: string[]) {
  const joined = (texts ?? []).join(" ").toLowerCase();
  return words.some((w) => joined.includes(w));
}

/** Bästa gissning på färdsätt utifrån alla tillgängliga signaler. */
export function inferTravelMode(input: TravelModeInput): TravelModeGuess {
  const meters = input.route?.meters ?? input.distanceM;
  const base = guessTravelMode(meters, input.minutesSpent);
  const reasons: string[] = [];

  if (input.route) {
    reasons.push(
      `Google Routes: ${(input.route.meters / 1000).toFixed(1)} km, bil ca ${Math.round(input.route.minutes)} min`,
    );
  }

  // Kalendern är den starkaste signalen när den är explicit.
  if (textHit(input.calendar, TRANSIT_WORDS)) {
    return { mode: "kollektivt", reason: [...reasons, "kalendern nämner kollektivtrafik"].join(" · ") };
  }
  if (textHit(input.calendar, WALK_WORDS)) {
    return { mode: "gang_cykel", reason: [...reasons, "kalendern nämner gång/cykel"].join(" · ") };
  }
  if (textHit(input.calendar, CAR_WORDS)) {
    return { mode: "bil", reason: [...reasons, "kalendern nämner bil"].join(" · ") };
  }

  const stationBoth = hasTransit(input.nearbyStart) && hasTransit(input.nearbyEnd);
  const routeMinutes = input.route?.minutes ?? 0;
  // Kollektivt tar normalt längre tid än bilrutten på samma sträcka.
  const slowerThanCar = routeMinutes > 0 && input.minutesSpent > routeMinutes * 1.35;

  if (stationBoth && meters >= 1500 && base !== "gang_cykel") {
    return {
      mode: "kollektivt",
      reason: [...reasons, "station/hållplats i både start och slut"].join(" · "),
    };
  }
  if (slowerThanCar && meters >= 2500 && base !== "gang_cykel") {
    return {
      mode: "kollektivt",
      reason: [...reasons, `restiden ${Math.round(input.minutesSpent)} min är klart längre än bilrutten`].join(" · "),
    };
  }

  if (input.route && input.minutesSpent > 0) {
    const kmh = input.route.meters / 1000 / (input.minutesSpent / 60);
    if (kmh >= 34) {
      return { mode: "bil", reason: [...reasons, `snitt ${Math.round(kmh)} km/h`].join(" · ") };
    }
    if (kmh < 9 && input.route.meters < 8000) {
      return {
        mode: "gang_cykel",
        reason: [...reasons, `snitt ${Math.round(kmh)} km/h`].join(" · "),
      };
    }
  }

  return {
    mode: base,
    reason: reasons.length ? reasons.join(" · ") : "uppskattat från fart och sträcka",
  };
}

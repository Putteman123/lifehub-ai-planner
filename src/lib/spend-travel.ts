/**
 * Kopplar en utgift till hur du tog dig dit, utifrån platsloggen.
 * Används av färdsättskolumnen i Pengar.
 */
import { travelModeLabel, type TravelMode, type VisitRow } from "@/lib/geo";

export type SpendTravel = {
  mode: TravelMode;
  label: string;
  /** Kort förklaring, t.ex. "resa 12 min innan köpet". */
  hint: string;
};

function ms(iso: string) {
  return new Date(iso).getTime();
}

function endOf(visit: VisitRow) {
  return visit.left_at ? ms(visit.left_at) : ms(visit.arrived_at) + 60 * 60_000;
}

/** Färdsätt för ett köp: resan som pågick, eller senaste resan innan köpet. */
export function spendTravelMode(spentAt: string, visits: VisitRow[]): SpendTravel | null {
  const t = ms(spentAt);

  const during = visits.find(
    (v) => v.entry_kind === "resa" && ms(v.arrived_at) <= t && endOf(v) >= t,
  );
  if (during && during.travel_mode !== "okant") {
    return {
      mode: during.travel_mode,
      label: travelModeLabel(during.travel_mode),
      hint: "köpet skedde under en resa",
    };
  }

  // Annars: senaste resan som slutade inom 90 minuter före köpet.
  const before = visits
    .filter((v) => v.entry_kind === "resa" && v.travel_mode !== "okant" && endOf(v) <= t)
    .sort((a, b) => endOf(b) - endOf(a))[0];
  if (before && t - endOf(before) <= 90 * 60_000) {
    const mins = Math.max(1, Math.round((t - endOf(before)) / 60_000));
    return {
      mode: before.travel_mode,
      label: travelModeLabel(before.travel_mode),
      hint: `resa ${mins} min innan köpet`,
    };
  }

  return null;
}

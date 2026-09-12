/**
 * Sparade Matrix-resor som kalenderhändelser.
 * Resorna är skrivskyddade i kalendern – de redigeras under Platser → Matrix.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { EventRow } from "@/lib/categories";

export const TRIP_EVENT_PREFIX = "trip:";

/** Sant om kalenderhändelsen egentligen är en sparad resa. */
export function isTripEvent(event: { id: string }) {
  return event.id.startsWith(TRIP_EVENT_PREFIX);
}

const mil = (km: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(km / 10);

type TripRow = {
  id: string;
  user_id: string;
  from_label: string;
  to_label: string;
  driven_on: string;
  driven_km: number;
  purpose: string | null;
  route_meters: number | null;
  route_minutes: number | null;
};

/** Hämtar resorna och gör om dem till heldagshändelser. */
export function useTripEvents() {
  return useQuery({
    queryKey: ["trip_logs", "calendar"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("trip_logs")
        .select(
          "id,user_id,from_label,to_label,driven_on,driven_km,purpose,route_meters,route_minutes",
        )
        .order("driven_on", { ascending: true });
      if (error) throw new Error(error.message);

      return ((data ?? []) as TripRow[]).map((trip) => {
        const start = new Date(`${trip.driven_on}T08:00:00`);
        const end = new Date(`${trip.driven_on}T09:00:00`);
        const googleKm = trip.route_meters ? trip.route_meters / 1000 : null;
        const detail = [
          `${mil(trip.driven_km)} mil körda`,
          googleKm ? `Google: ${mil(googleKm)} mil` : null,
          trip.route_minutes ? `${trip.route_minutes} min` : null,
          trip.purpose,
        ]
          .filter(Boolean)
          .join(" · ");

        return {
          id: `${TRIP_EVENT_PREFIX}${trip.id}`,
          user_id: trip.user_id,
          calendar_id: null,
          child_id: null,
          case_id: null,
          title: `🚗 ${trip.from_label} → ${trip.to_label} · ${mil(trip.driven_km)} mil`,
          description: detail,
          location: trip.to_label,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          all_day: true,
          category: "privat",
          external_id: null,
          created_at: start.toISOString(),
          updated_at: start.toISOString(),
        } as EventRow;
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}

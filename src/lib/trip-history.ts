import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TripEdit = {
  id: string;
  visit_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export const TRIP_FIELD_LABELS: Record<string, string> = {
  arrived_at: "Starttid",
  left_at: "Sluttid",
  start_place: "Startplats",
  end_place: "Slutplats",
  distance_m: "Avstånd",
  distance_verified: "Verifiering",
  travel_mode: "Färdsätt",
  label: "Tagg",
};

export function tripFieldLabel(field: string) {
  return TRIP_FIELD_LABELS[field] ?? field;
}

/** Historik för en resa, nyast först. */
export function useTripHistory(visitId: string | null) {
  return useQuery({
    queryKey: ["visit_edits", visitId],
    enabled: !!visitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_edits")
        .select("*")
        .eq("visit_id", visitId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as TripEdit[];
    },
  });
}

export function useLogTripEdits() {
  const qc = useQueryClient();
  return async (
    visitId: string,
    changes: { field: string; old_value: string | null; new_value: string | null }[],
  ) => {
    if (changes.length === 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData.user?.id;
    if (!user_id) return;
    await supabase
      .from("visit_edits")
      .insert(changes.map((c) => ({ ...c, visit_id: visitId, user_id })));
    qc.invalidateQueries({ queryKey: ["visit_edits", visitId] });
  };
}

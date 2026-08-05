import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type {
  CalendarRow,
  CaseRow,
  CaseTaskRow,
  ChildRow,
  EventRow,
  ReminderRow,
} from "./categories";
import type { PlaceRow, VisitRow } from "./geo";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () =>
      unwrap<EventRow[]>(
        await supabase.from("events").select("*").order("starts_at", { ascending: true }),
      ),
  });
}

export function useCalendars() {
  return useQuery({
    queryKey: ["calendars"],
    queryFn: async () =>
      unwrap<CalendarRow[]>(
        await supabase.from("calendars").select("*").order("created_at", { ascending: true }),
      ),
  });
}

export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: async () =>
      unwrap<ChildRow[]>(
        await supabase.from("children").select("*").order("created_at", { ascending: true }),
      ),
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["legal_cases"],
    queryFn: async () =>
      unwrap<CaseRow[]>(
        await supabase.from("legal_cases").select("*").order("created_at", { ascending: false }),
      ),
  });
}

export function useCaseTasks() {
  return useQuery({
    queryKey: ["case_tasks"],
    queryFn: async () =>
      unwrap<CaseTaskRow[]>(
        await supabase.from("case_tasks").select("*").order("due_date", { ascending: true }),
      ),
  });
}

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async () =>
      unwrap<ReminderRow[]>(
        await supabase.from("reminders").select("*").order("remind_at", { ascending: true }),
      ),
  });
}

export function usePlaces() {
  return useQuery({
    queryKey: ["places"],
    queryFn: async () =>
      unwrap<PlaceRow[]>(
        await supabase.from("places").select("*").order("name", { ascending: true }),
      ),
  });
}

export function useVisits(sinceIso?: string) {
  return useQuery({
    queryKey: ["visits", sinceIso ?? "all"],
    queryFn: async () => {
      let query = supabase.from("visits").select("*").order("arrived_at", { ascending: false });
      if (sinceIso) query = query.gte("arrived_at", sinceIso);
      return unwrap<VisitRow[]>(await query.limit(500));
    },
    refetchInterval: 60000,
  });
}

type TableName =
  | "events"
  | "calendars"
  | "children"
  | "legal_cases"
  | "case_tasks"
  | "reminders"
  | "places"
  | "visits";

const QUERY_KEY: Record<TableName, string> = {
  events: "events",
  calendars: "calendars",
  children: "children",
  legal_cases: "legal_cases",
  case_tasks: "case_tasks",
  reminders: "reminders",
  places: "places",
  visits: "visits",
};

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

export function useUpsertRow(table: TableName, successMessage = "Sparat") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const user_id = await currentUserId();
      const { error } = await supabase
        .from(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ ...values, user_id } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY[table]] });
      toast.success(successMessage);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteRow(table: TableName, successMessage = "Borttaget") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY[table]] });
      toast.success(successMessage);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  approveMailFinding,
  dismissMailFinding,
  scanMailForFinance,
} from "@/lib/mail-scan.functions";

export type MailFindingRow = Tables<"mail_findings">;

export const MAIL_FINDING_LABEL: Record<string, string> = {
  faktura: "Att betala",
  kvitto: "Betalt med kort",
  prenumeration: "Prenumeration",
  mote: "Mötesförfrågan",
};

export type MeetingSlotJson = { start: string; end: string };

/** Läser ut föreslagna mötestider ur ett fynd. */
export function findingSlots(row: MailFindingRow): MeetingSlotJson[] {
  const raw = (row as { suggested_slots?: unknown }).suggested_slots;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is MeetingSlotJson =>
      Boolean(s) && typeof (s as MeetingSlotJson).start === "string" && typeof (s as MeetingSlotJson).end === "string",
  );
}

/** Fynd som väntar på godkännande. */
export function useMailFindings() {
  return useQuery({
    queryKey: ["mail_findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mail_findings")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as MailFindingRow[];
    },
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["mail_findings"] });
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["spend_entries"] });
    qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
    qc.invalidateQueries({ queryKey: ["finance_accounts"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };
}

/** Söker igenom inkorgen efter nya ekonomifynd. */
export function useScanMail() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (opts?: { days?: number }) =>
      scanMailForFinance({ data: { days: opts?.days ?? 30 } }),
    onSuccess: (res) => {
      refresh();
      if (!res.connected) toast.error("Gmail är inte kopplat.");
      else if (res.created)
        toast.success(`${res.created} nya fynd att godkänna (${res.scanned} mejl lästa).`);
      else toast.info(`Inget nytt att godkänna – ${res.scanned} mejl lästa.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export type ApproveInput = {
  id: string;
  kind: "faktura" | "kvitto" | "prenumeration" | "mote";
  merchant: string;
  amount: number;
  category: string | null;
  dueDate: string | null;
  occurredAt: string | null;
  accountId: string | null;
  intervalMonths: number;
  slotStart?: string | null;
  slotEnd?: string | null;
};

/** Godkänner ett fynd och lägger in det i systemet. */
export function useApproveFinding() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: ApproveInput) => approveMailFinding({ data: values }),
    onSuccess: (res) => {
      refresh();
      toast.success(res.message || "Godkänt.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Avfärdar ett fynd. */
export function useDismissFinding() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => dismissMailFinding({ data: { id } }),
    onSuccess: () => {
      refresh();
      toast.success("Avfärdat.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

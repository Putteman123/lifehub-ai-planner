import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TransferRow = Tables<"account_transfers">;

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

/** Flyttar saldo på ett konto med angiven förändring. */
export async function moveBalance(accountId: string | null | undefined, delta: number) {
  if (!accountId || !delta) return;
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("balance")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data) return;
  const { error: updateError } = await supabase
    .from("finance_accounts")
    .update({ balance: Number(data.balance) + delta })
    .eq("id", accountId);
  if (updateError) throw new Error(updateError.message);
}

/** Alla överföringar, senaste först. */
export function useTransfers() {
  return useQuery({
    queryKey: ["account_transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transfers")
        .select("*")
        .order("transferred_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as TransferRow[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["account_transfers"] });
    qc.invalidateQueries({ queryKey: ["finance_accounts"] });
  };
}

export type TransferInput = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note?: string | null;
};

/** Skapar en överföring och flyttar pengarna mellan kontona. */
export function useSaveTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (values: TransferInput) => {
      if (values.from_account_id === values.to_account_id) {
        throw new Error("Välj två olika konton.");
      }
      if (!(values.amount > 0)) throw new Error("Ange ett belopp större än noll.");
      const user_id = await currentUserId();
      const { error } = await supabase.from("account_transfers").insert({
        user_id,
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        amount: values.amount,
        note: values.note?.trim() || null,
      });
      if (error) throw new Error(error.message);
      await moveBalance(values.from_account_id, -values.amount);
      await moveBalance(values.to_account_id, values.amount);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Överföring klar");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Ångrar en överföring och för tillbaka pengarna. */
export function useUndoTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: TransferRow) => {
      const { error } = await supabase.from("account_transfers").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      await moveBalance(row.from_account_id, Number(row.amount));
      await moveBalance(row.to_account_id, -Number(row.amount));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Överföringen är ångrad");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

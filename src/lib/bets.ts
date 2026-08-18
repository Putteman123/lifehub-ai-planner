import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { moveBalance } from "@/lib/transfers";

export type BetRow = Tables<"bets">;

export const BET_CATEGORY = "Spel";
export const BET_ACCOUNT_NAME = "ATG";

export const GAME_TYPES = [
  "V75",
  "V86",
  "V64",
  "V65",
  "V4",
  "V5",
  "GS75",
  "Dagens Dubbel",
  "Trio",
  "Vinnare",
  "Plats",
  "Annat",
];

export const BET_STATUS: { value: string; label: string }[] = [
  { value: "oavgjort", label: "Oavgjort" },
  { value: "forlorat", label: "Förlorat" },
  { value: "vinst", label: "Vinst" },
];

export function betStatusLabel(value: string) {
  return BET_STATUS.find((s) => s.value === value)?.label ?? value;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

/** Alla registrerade spel, senaste först. */
export function useBets() {
  return useQuery({
    queryKey: ["bets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .order("bet_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as BetRow[];
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["bets"] });
    qc.invalidateQueries({ queryKey: ["spend_entries"] });
    qc.invalidateQueries({ queryKey: ["finance_accounts"] });
  };
}

export type BetInput = {
  bet_date: string;
  track?: string | null;
  game_type: string;
  rows_count: number;
  stake: number;
  note?: string | null;
  account_id: string | null;
  receipt_path?: string | null;
  raw_ai?: unknown;
};

/**
 * Sparar ett nytt spel. Insatsen bokförs som en utgift i kategorin Spel och
 * dras från valt konto (normalt ATG).
 */
export function useSaveBet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (values: BetInput) => {
      const user_id = await currentUserId();

      let spendId: string | null = null;
      if (values.stake > 0) {
        const { data: spend, error: spendError } = await supabase
          .from("spend_entries")
          .insert({
            user_id,
            amount: values.stake,
            category: BET_CATEGORY,
            note: [values.game_type, values.track].filter(Boolean).join(" – ") || "Spel",
            account_id: values.account_id,
            spent_at: new Date(`${values.bet_date}T12:00:00`).toISOString(),
          })
          .select("id")
          .single();
        if (spendError) throw new Error(spendError.message);
        spendId = spend.id;
        await moveBalance(values.account_id, -values.stake);
      }

      const { error } = await supabase.from("bets").insert({
        user_id,
        bet_date: values.bet_date,
        track: values.track?.trim() || null,
        game_type: values.game_type,
        rows_count: values.rows_count,
        stake: values.stake,
        payout: 0,
        status: "oavgjort",
        account_id: values.account_id,
        spend_id: spendId,
        receipt_path: values.receipt_path ?? null,
        note: values.note?.trim() || null,
        raw_ai: (values.raw_ai ?? null) as never,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Spelet är registrerat");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Rättar ett spel: sätter utfall och lägger eventuell vinst på kontot. */
export function useSettleBet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ bet, payout }: { bet: BetRow; payout: number }) => {
      const status = payout > 0 ? "vinst" : "forlorat";
      const delta = payout - Number(bet.payout ?? 0);
      const { error } = await supabase
        .from("bets")
        .update({ payout, status })
        .eq("id", bet.id);
      if (error) throw new Error(error.message);
      if (delta) await moveBalance(bet.account_id, delta);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Spelet är rättat");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tar bort ett spel, dess utgift och återställer saldot. */
export function useDeleteBet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (bet: BetRow) => {
      if (bet.spend_id) {
        await supabase.from("spend_entries").delete().eq("id", bet.spend_id);
        await moveBalance(bet.account_id, Number(bet.stake));
      }
      if (Number(bet.payout) > 0) await moveBalance(bet.account_id, -Number(bet.payout));
      const { error } = await supabase.from("bets").delete().eq("id", bet.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Spelet är borttaget");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Summering av insats, vinst, netto och träffprocent för en period. */
export function betSummary(bets: BetRow[], days: number) {
  const since = Date.now() - days * 86_400_000;
  const rows = bets.filter((b) => new Date(`${b.bet_date}T12:00:00`).getTime() >= since);
  const stake = rows.reduce((sum, b) => sum + Number(b.stake), 0);
  const payout = rows.reduce((sum, b) => sum + Number(b.payout), 0);
  const settled = rows.filter((b) => b.status !== "oavgjort");
  const wins = settled.filter((b) => b.status === "vinst").length;
  return {
    count: rows.length,
    stake,
    payout,
    net: payout - stake,
    hitRate: settled.length ? Math.round((wins / settled.length) * 100) : 0,
  };
}

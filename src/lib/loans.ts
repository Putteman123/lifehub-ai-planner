import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LoanRow = Tables<"loans">;

/** Kategorier som lånets fasta utgifter hamnar på. */
export const LOAN_CATEGORY = "Lån";
export const INTEREST_CATEGORY = "Ränta";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

/** Alla lån, senast tillagda först. */
export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as LoanRow[];
    },
  });
}

export type LoanInput = {
  id?: string;
  name: string;
  principal: number;
  disbursed_on: string;
  account_id: string | null;
  monthly_payment: number;
  monthly_interest: number;
  due_day: number;
  note?: string | null;
  is_active?: boolean;
};

function clampDay(day: number) {
  if (!Number.isFinite(day)) return 27;
  return Math.min(Math.max(Math.round(day), 1), 28);
}

/**
 * Speglar lånet till en inbetalning (lånebeloppet) och två fasta utgifter
 * (amortering + ränta) så att budgeten och Att göra-flödet fungerar som
 * för vilken annan post som helst.
 */
async function syncLoanRows(loan: LoanRow) {
  const user_id = loan.user_id;

  // Inbetalning: pengarna som kom in när lånet betalades ut.
  const { data: income } = await supabase
    .from("finance_incomes")
    .select("id, is_received")
    .eq("loan_id", loan.id)
    .maybeSingle();

  const incomeValues = {
    user_id,
    loan_id: loan.id,
    label: `${loan.name} – lån utbetalat`,
    amount: Number(loan.principal),
    expected_on: loan.disbursed_on,
    kind: "lan",
    is_received: income?.is_received ?? false,
  };
  if (income) {
    await supabase.from("finance_incomes").update(incomeValues).eq("id", income.id);
  } else if (Number(loan.principal) > 0) {
    await supabase.from("finance_incomes").insert(incomeValues);
  }

  // Fasta utgifter: amortering och ränta som separata rader.
  const parts: { part: string; suffix: string; amount: number; category: string }[] = [
    {
      part: "amortering",
      suffix: "amortering",
      amount: Number(loan.monthly_payment),
      category: LOAN_CATEGORY,
    },
    {
      part: "ranta",
      suffix: "ränta",
      amount: Number(loan.monthly_interest),
      category: INTEREST_CATEGORY,
    },
  ];

  const { data: existing } = await supabase
    .from("fixed_expenses")
    .select("id, part")
    .eq("loan_id", loan.id);

  for (const part of parts) {
    const row = (existing ?? []).find((e) => e.part === part.part);
    const values = {
      user_id,
      loan_id: loan.id,
      part: part.part,
      name: `${loan.name} – ${part.suffix}`,
      amount: part.amount,
      due_day: clampDay(loan.due_day),
      category: part.category,
      is_active: loan.is_active && part.amount > 0,
    };
    if (row) {
      await supabase.from("fixed_expenses").update(values).eq("id", row.id);
    } else if (part.amount > 0) {
      await supabase.from("fixed_expenses").insert(values);
    }
  }
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["finance_incomes"] });
    qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
    qc.invalidateQueries({ queryKey: ["fixed_expense_payments"] });
  };
}

/** Skapar eller uppdaterar ett lån och synkar in- och utbetalningarna. */
export function useSaveLoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: LoanInput) => {
      if (!input.name.trim()) throw new Error("Ge lånet ett namn.");
      const user_id = await currentUserId();
      const values = {
        ...(input.id ? { id: input.id } : {}),
        user_id,
        name: input.name.trim(),
        principal: input.principal,
        disbursed_on: input.disbursed_on,
        account_id: input.account_id || null,
        monthly_payment: input.monthly_payment,
        monthly_interest: input.monthly_interest,
        due_day: clampDay(input.due_day),
        note: input.note?.trim() || null,
        is_active: input.is_active ?? true,
      };
      const { data, error } = await supabase
        .from("loans")
        .upsert(values)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await syncLoanRows(data as LoanRow);
      return data as LoanRow;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lånet är sparat");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tar bort lånet och de rader det skapat. */
export function useDeleteLoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("fixed_expenses").delete().eq("loan_id", id);
      await supabase.from("finance_incomes").delete().eq("loan_id", id);
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lånet är borttaget");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Summa som betalats på lånet (registrerade betalningar av dess fasta utgifter). */
export function loanPaidTotal(
  loanId: string,
  fixed: { id: string; loan_id: string | null }[],
  payments: { expense_id: string; amount: number | string }[],
) {
  const ids = new Set(fixed.filter((f) => f.loan_id === loanId).map((f) => f.id));
  return payments
    .filter((p) => ids.has(p.expense_id))
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

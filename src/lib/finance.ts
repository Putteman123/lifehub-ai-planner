import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { dayKey } from "@/lib/tz";
import { fixedViews, type FixedPaymentRow } from "@/lib/fixed-expenses";


export type AccountRow = Tables<"finance_accounts">;
export type IncomeRow = Tables<"finance_incomes">;
export type FixedExpenseRow = Tables<"fixed_expenses">;
export type SpendRow = Tables<"spend_entries">;
export type FinanceFileRow = Tables<"finance_files">;

export const FINANCE_BUCKET = "ekonomi";

export const INCOME_KINDS: { value: string; label: string }[] = [
  { value: "lon", label: "Lön" },
  { value: "ersattning", label: "Ersättning" },
  { value: "bidrag", label: "Bidrag" },
  { value: "lan", label: "Lån" },
  { value: "extra", label: "Extra" },
  { value: "annat", label: "Annat" },
];

export const FILE_KINDS: { value: string; label: string }[] = [
  { value: "lonespec", label: "Lönespec" },
  { value: "faktura", label: "Faktura" },
  { value: "kvitto", label: "Kvitto" },
  { value: "annat", label: "Annat" },
];

/** Formaterar belopp i svenska kronor utan decimaler. */
export function kr(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dagar kvar till nästa inbetalning (minst 1 så division alltid går). */
export function daysUntil(dateIso: string) {
  const target = new Date(`${dateIso.slice(0, 10)}T00:00:00`);
  const diff = Math.ceil((target.getTime() - startOfToday().getTime()) / 86_400_000);
  return Math.max(diff, 0);
}

/** Nästa inbetalning som ännu inte kommit in. */
export function nextIncome(incomes: IncomeRow[]) {
  const today = startOfToday().getTime();
  return (
    [...incomes]
      .filter((i) => !i.is_received)
      .filter((i) => new Date(`${i.expected_on}T00:00:00`).getTime() >= today)
      .sort((a, b) => a.expected_on.localeCompare(b.expected_on))[0] ?? null
  );
}

export type Budget = {
  balance: number;
  income: IncomeRow | null;
  days: number;
  fixedLeft: number;
  spentThisPeriod: number;
  spentToday: number;
  available: number;
  perDay: number;
  todayLeft: number;
  /** Mottagna inbetalningar sedan månadsskiftet. */
  incomeThisPeriod: number;
  /** Inbetalt minus spenderat sedan månadsskiftet. */
  netThisPeriod: number;
};

/** Datumet en inbetalning räknas på: faktiskt mottaget, annars förväntat. */
export function incomeDate(row: IncomeRow) {
  return (row.received_on ?? row.expected_on).slice(0, 10);
}


/** Summerar utgifter per svensk kalenderdag. */
export function spendByDay(spends: SpendRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of spends) {
    const key = dayKey(s.spent_at);
    map[key] = (map[key] ?? 0) + Number(s.amount);
  }
  return map;
}

/**
 * Dagsbudget = totalt saldo minus kvarvarande fasta utgifter före nästa
 * inbetalning, delat på antal dagar dit. Nollställs varje dygn eftersom
 * "spenderat idag" räknas från dagens början. Redan betalda fasta utgifter
 * räknas inte med, medan obetalda restskulder från tidigare månader gör det.
 */
export function buildBudget(
  accounts: AccountRow[],
  incomes: IncomeRow[],
  fixed: FixedExpenseRow[],
  spends: SpendRow[],
  payments: FixedPaymentRow[] = [],
): Budget {
  const balance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const income = nextIncome(incomes);
  const days = income ? Math.max(daysUntil(income.expected_on), 1) : 30;

  const today = new Date();
  const limit = income ? new Date(`${income.expected_on}T00:00:00`) : null;
  const views = fixedViews(fixed, payments, today);
  const viewOf = new Map(views.map((v) => [v.row.id, v]));

  const fixedLeft =
    fixed
      .filter((e) => e.is_active)
      .filter((e) => {
        const status = viewOf.get(e.id)?.status;
        return status !== "betald" && status !== "vilande";
      })

      .filter((e) => {
        if (!limit) return false;
        const due = new Date(today.getFullYear(), today.getMonth(), e.due_day);
        if (due < today) due.setMonth(due.getMonth() + 1);
        return due <= limit;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0) +
    views
      .filter((v) => v.row.is_active)
      .reduce((sum, v) => sum + v.carryOver.length * Number(v.row.amount), 0);

  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const spentThisPeriod = spends
    .filter((s) => new Date(s.spent_at).getTime() >= periodStart)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const todayKey = dayKey(today);
  const spentToday = spends
    .filter((s) => dayKey(s.spent_at) === todayKey)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const incomeThisPeriod = incomes
    .filter((i) => i.is_received && incomeDate(i).startsWith(monthKey))
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const available = balance - fixedLeft;
  const perDay = available / days;
  return {
    balance,
    income,
    days,
    fixedLeft,
    spentThisPeriod,
    spentToday,
    available,
    perDay,
    todayLeft: perDay - spentToday,
    incomeThisPeriod,
    netThisPeriod: incomeThisPeriod - spentThisPeriod,
  };
}

/** Ger dagens datumnyckel och byter värde exakt vid midnatt (svensk tid). */
export function useDayTick(): string {
  const [key, setKey] = useState(() => dayKey(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 2, 0);
      timer = setTimeout(() => {
        setKey(dayKey(new Date()));
        schedule();
      }, Math.max(next.getTime() - now.getTime(), 1000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return key;
}


async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

function useRows<T>(key: string, table: string, order: { column: string; asc: boolean }) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .select("*")
        .order(order.column, { ascending: order.asc });
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
  });
}

export const useAccounts = () =>
  useRows<AccountRow>("finance_accounts", "finance_accounts", {
    column: "sort_order",
    asc: true,
  });

export const useIncomes = () =>
  useRows<IncomeRow>("finance_incomes", "finance_incomes", {
    column: "expected_on",
    asc: true,
  });

export const useFixedExpenses = () =>
  useRows<FixedExpenseRow>("fixed_expenses", "fixed_expenses", { column: "due_day", asc: true });

/** Registrerade betalningar av fasta utgifter, per månad. */
export const useFixedPayments = () =>
  useRows<FixedPaymentRow>("fixed_expense_payments", "fixed_expense_payments", {
    column: "period",
    asc: false,
  });

export const useSpends = () =>
  useRows<SpendRow>("spend_entries", "spend_entries", { column: "spent_at", asc: false });

export const useFinanceFiles = () =>
  useRows<FinanceFileRow>("finance_files", "finance_files", { column: "created_at", asc: false });

type FinanceTable =
  | "finance_accounts"
  | "finance_incomes"
  | "fixed_expenses"
  | "spend_entries"
  | "finance_files";

export function useSaveFinance(table: FinanceTable, message = "Sparat") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const user_id = await currentUserId();
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ ...values, user_id } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteFinance(table: FinanceTable, message = "Borttaget") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUploadFinanceFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, kind }: { files: File[]; kind: string }) => {
      const user_id = await currentUserId();
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user_id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(FINANCE_BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (uploadError) throw new Error(uploadError.message);
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("finance_files" as any)
          .insert({
            user_id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            kind,
          });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance_files"] });
      toast.success("Uppladdat");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteFinanceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: FinanceFileRow) => {
      await supabase.storage.from(FINANCE_BUCKET).remove([file.storage_path]);
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("finance_files" as any)
        .delete()
        .eq("id", file.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance_files"] });
      toast.success("Filen är borttagen");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tidsbegränsad länk till ett privat ekonomidokument (1 timme). */
export async function financeSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(FINANCE_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? "Kunde inte skapa länk.");
  return data.signedUrl;
}

/** Justerar saldot på ett konto med angiven förändring. */
async function adjustBalance(accountId: string | null | undefined, delta: number) {
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

export type SpendInput = {
  id?: string;
  amount: number;
  note?: string | null;
  category?: string | null;
  account_id?: string | null;
  spent_at?: string;
};

/**
 * Sparar en utgift och drar beloppet från valt konto. Vid redigering
 * återförs det gamla beloppet först så saldot alltid stämmer.
 */
export function useSaveSpend(message = "Utgift registrerad") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      values,
      previous,
    }: {
      values: SpendInput;
      previous?: SpendRow | null;
    }) => {
      const user_id = await currentUserId();
      const { error } = await supabase
        .from("spend_entries")
        .upsert({ ...values, user_id, amount: values.amount });
      if (error) throw new Error(error.message);

      if (previous) await adjustBalance(previous.account_id, Number(previous.amount));
      await adjustBalance(values.account_id ?? null, -values.amount);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend_entries"] });
      qc.invalidateQueries({ queryKey: ["finance_accounts"] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tar bort en utgift och lägger tillbaka beloppet på kontot. */
export function useDeleteSpend(message = "Utgift borttagen") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: SpendRow) => {
      const { error } = await supabase.from("spend_entries").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      await adjustBalance(row.account_id, Number(row.amount));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend_entries"] });
      qc.invalidateQueries({ queryKey: ["finance_accounts"] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Ger dagsresultat per datum: dagsbudget minus det som spenderades den dagen.
 * Positivt = sparat, negativt = överspenderat.
 */
export function useDailyResult() {
  const accountsQ = useAccounts();
  const incomesQ = useIncomes();
  const fixedQ = useFixedExpenses();
  const spendsQ = useSpends();
  const paymentsQ = useFixedPayments();
  const today = useDayTick();

  const accounts = accountsQ.data;
  const incomes = incomesQ.data;
  const fixed = fixedQ.data;
  const spends = spendsQ.data;
  const payments = paymentsQ.data;

  return useMemo(() => {
    if (!accounts?.length) return null;
    const budget = buildBudget(accounts, incomes ?? [], fixed ?? [], spends ?? [], payments ?? []);
    const perDayMap = spendByDay(spends ?? []);
    return (date: Date | string) => {
      const key = dayKey(date);
      if (key > today) return null;
      const spent = perDayMap[key];
      if (spent === undefined && key !== today) return null;
      return budget.perDay - (spent ?? 0);
    };
  }, [accounts, incomes, fixed, spends, payments, today]);
}

export type IncomeInput = {
  id?: string;
  label: string;
  amount: number;
  expected_on: string;
  kind: string;
  is_received: boolean;
  received_on?: string | null;
  account_id?: string | null;
  category?: string | null;
  note?: string | null;
};

/**
 * Sparar en inbetalning på samma sätt som en utgift: när den är markerad som
 * inkommen läggs beloppet till på valt konto. Vid ändring återförs först det
 * gamla beloppet så saldot alltid stämmer.
 */
export function useSaveIncome(message = "Inbetalning sparad") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      values,
      previous,
    }: {
      values: IncomeInput;
      previous?: IncomeRow | null;
    }) => {
      const user_id = await currentUserId();
      const { error } = await supabase.from("finance_incomes").upsert({ ...values, user_id });
      if (error) throw new Error(error.message);

      if (previous?.is_received) {
        await adjustBalance(previous.account_id, -Number(previous.amount));
      }
      if (values.is_received) {
        await adjustBalance(values.account_id ?? null, values.amount);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance_incomes"] });
      qc.invalidateQueries({ queryKey: ["finance_accounts"] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tar bort en inbetalning och backar saldot om den var inkommen. */
export function useDeleteIncome(message = "Inbetalning borttagen") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: IncomeRow) => {
      const { error } = await supabase.from("finance_incomes").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      if (row.is_received) await adjustBalance(row.account_id, -Number(row.amount));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance_incomes"] });
      qc.invalidateQueries({ queryKey: ["finance_accounts"] });
      toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Markerar en inbetalning som inkommen (eller ångrar den) och justerar saldot. */
export function useSetIncomeReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, received }: { row: IncomeRow; received: boolean }) => {
      if (row.is_received === received) return;
      const receivedOn = received ? new Date().toISOString().slice(0, 10) : null;
      const { error } = await supabase
        .from("finance_incomes")
        .update({ is_received: received, received_on: receivedOn })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      await adjustBalance(row.account_id, received ? Number(row.amount) : -Number(row.amount));
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["finance_incomes"] });
      qc.invalidateQueries({ queryKey: ["finance_accounts"] });
      toast.success(vars.received ? "Inbetalning bokförd" : "Inbetalning ångrad");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

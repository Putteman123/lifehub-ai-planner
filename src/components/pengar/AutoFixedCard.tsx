import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { saveFixedExpense } from "@/lib/finance.functions";
import { kr, type AccountRow, type FixedExpenseRow, type SpendRow } from "@/lib/finance";
import type { FixedPaymentRow } from "@/lib/fixed-expenses";
import {
  fixedAccountFromHistory,
  fixedAmountDrift,
  planFixedExpenses,
  type PlannedFixed,
} from "@/lib/income-recurrence";

/**
 * Bygger utgiftssidan från tidigare månader: köp som återkommer blir fasta
 * utgifter med rätt belopp och konto, och belopp som glidit uppdateras.
 */
export function AutoFixedCard({
  spends,
  fixed,
  payments,
  accounts,
  className,
}: {
  spends: SpendRow[];
  fixed: FixedExpenseRow[];
  payments: FixedPaymentRow[];
  accounts: AccountRow[];
  className?: string;
}) {
  const qc = useQueryClient();

  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "inget konto";

  const planned = useMemo(() => planFixedExpenses(spends, fixed).slice(0, 6), [spends, fixed]);
  const drift = useMemo(
    () =>
      fixedAmountDrift(
        fixed.map((row) => ({
          id: row.id,
          name: row.name,
          amount: Number(row.amount),
          is_active: row.is_active,
        })),
        payments.map((p) => ({
          expense_id: p.expense_id,
          amount: Number(p.amount),
          period: p.period,
        })),
      ).slice(0, 5),
    [fixed, payments],
  );

  // Fasta utgifter som saknar konto men som historiskt betalats från ett.
  const missingAccount = useMemo(
    () =>
      fixed
        .filter((row) => row.is_active && !row.account_id)
        .map((row) => ({ row, accountId: fixedAccountFromHistory(row.id, payments) }))
        .filter((item): item is { row: FixedExpenseRow; accountId: string } =>
          Boolean(item.accountId),
        ),
    [fixed, payments],
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
    void qc.invalidateQueries({ queryKey: ["events"] });
  };

  const create = useMutation({
    mutationFn: async (rows: PlannedFixed[]) => {
      for (const row of rows) {
        await saveFixedExpense({
          data: {
            name: row.name,
            amount: row.amount,
            due_day: row.due_day,
            category: row.category,
            account_id: row.account_id,
            is_active: true,
            is_subscription: false,
            interval_months: 1,
            anchor_month: null,
            sync_calendar: true,
          },
        });
      }
      return rows.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast.success(`${count} fast${count === 1 ? " utgift" : "a utgifter"} tillagd${count === 1 ? "" : "a"}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async (input: { row: FixedExpenseRow; amount?: number; accountId?: string }) => {
      const { row } = input;
      await saveFixedExpense({
        data: {
          id: row.id,
          name: row.name,
          amount: input.amount ?? Number(row.amount),
          due_day: row.due_day,
          category: row.category,
          account_id: input.accountId ?? row.account_id ?? null,
          is_active: row.is_active,
          is_subscription: Boolean(row.is_subscription),
          interval_months: Number(row.interval_months ?? 1),
          anchor_month: row.anchor_month ?? null,
          sync_calendar: row.sync_calendar !== false,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Uppdaterad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (planned.length === 0 && drift.length === 0 && missingAccount.length === 0) return null;

  return (
    <SectionCard
      title="Utgifter från tidigare månader"
      icon={Repeat}
      accent="text-nav-jurist"
      tint="bg-nav-jurist/12"
      {...(className ? { className } : {})}
      action={
        planned.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={create.isPending}
            onClick={() => create.mutate(planned)}
          >
            Lägg in {planned.length}
          </Button>
        ) : null
      }
    >
      {planned.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Dessa köp återkommer varje månad. Beloppet och kontot kommer från dina egna
            betalningar.
          </p>
          <ul className="mt-3 space-y-1.5">
            {planned.map((row) => (
              <li
                key={row.key}
                className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{row.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Wallet className="size-3" />
                    {accountName(row.account_id)} · den {row.due_day}:e · {row.months} mån
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{kr(row.amount)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={create.isPending}
                  onClick={() => create.mutate([row])}
                >
                  <Plus className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {drift.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <TrendingUp className="size-3.5" /> Belopp som ändrats
          </p>
          <ul className="space-y-1.5">
            {drift.map((row) => {
              const target = fixed.find((f) => f.id === row.id);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {kr(row.current)} → {kr(row.suggested)} enligt {row.months} betalningar
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={update.isPending || !target}
                    onClick={() => target && update.mutate({ row: target, amount: row.suggested })}
                  >
                    Uppdatera
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {missingAccount.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Wallet className="size-3.5" /> Saknar konto
          </p>
          <ul className="space-y-1.5">
            {missingAccount.map(({ row, accountId }) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{row.name}</span>
                  <span className="text-xs text-muted-foreground">
                    betalas oftast från {accountName(accountId)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ row, accountId })}
                >
                  Koppla
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

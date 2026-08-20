import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
import { PiggyMarker } from "@/components/pengar/PiggyMarker";
import {
  buildBudget,
  kr,
  useAccounts,
  useDayTick,
  useFixedExpenses,
  useFixedPayments,
  useIncomes,
  useSpends,
} from "@/lib/finance";

/** Visar hur mycket som får spenderas per dag fram till nästa inbetalning. */
export function MoneyWidget() {
  const accountsQ = useAccounts();
  const incomesQ = useIncomes();
  const fixedQ = useFixedExpenses();
  const spendsQ = useSpends();
  const paymentsQ = useFixedPayments();
  useDayTick();

  const accounts = accountsQ.data ?? [];
  if (accountsQ.isLoading || accounts.length === 0) return null;

  const budget = buildBudget(
    accounts,
    incomesQ.data ?? [],
    fixedQ.data ?? [],
    spendsQ.data ?? [],
    paymentsQ.data ?? [],
  );
  const negative = budget.todayLeft <= 0;

  return (
    <SectionCard
      title="Pengar"
      icon={Wallet}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      className="transition-shadow hover:shadow-lg"
    >
      <Link to="/pengar" className="block">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Att spendera idag</p>
          <PiggyMarker amount={budget.todayLeft} />
        </div>
        <p
          className={`mt-1 text-[34px] font-semibold tracking-tight tabular-nums ${
            negative ? "text-destructive" : "text-nav-pengar"
          }`}
        >
          {kr(budget.todayLeft)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {kr(budget.perDay)} per dag ·{" "}
          {budget.income
            ? `${budget.days} dagar till ${budget.income.label}`
            : "ingen kommande inbetalning inlagd"}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Saldo", value: kr(budget.balance) },
            { label: "Fasta kvar", value: kr(budget.fixedLeft) },
            { label: "Idag", value: kr(budget.spentToday) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-surface px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>

        <span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-nav-pengar">
          Öppna ekonomi →
        </span>
      </Link>
    </SectionCard>
  );
}


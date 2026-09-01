import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

import { kr, type Budget } from "@/lib/finance";

/** Sammanfattningsrad högst upp på Pengar: saldo, dagsbudget och månadens netto. */
export function MoneyHeader({ budget }: { budget: Budget }) {
  const items = [
    {
      label: "Totalt saldo",
      value: kr(budget.balance),
      icon: Wallet,
      tone: "text-nav-pengar",
      tint: "bg-nav-pengar/12",
    },
    {
      label: "Att spendera idag",
      value: kr(budget.todayLeft),
      icon: budget.todayLeft >= 0 ? ArrowUpRight : ArrowDownRight,
      tone: budget.todayLeft >= 0 ? "text-cat-ledig" : "text-destructive",
      tint: budget.todayLeft >= 0 ? "bg-cat-ledig/12" : "bg-destructive/12",
    },
    {
      label: "Netto denna månad",
      value: kr(budget.netThisPeriod),
      icon: budget.netThisPeriod >= 0 ? ArrowUpRight : ArrowDownRight,
      tone: budget.netThisPeriod >= 0 ? "text-cat-ledig" : "text-destructive",
      tint: budget.netThisPeriod >= 0 ? "bg-cat-ledig/12" : "bg-destructive/12",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-card/70 p-2 backdrop-blur sm:gap-3 sm:p-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl bg-surface px-2.5 py-2 sm:px-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-md ${item.tint} ${item.tone}`}
            >
              <item.icon className="size-3" />
            </span>
            <span className="truncate">{item.label}</span>
          </p>
          <p
            className={`mt-1 truncate text-[19px] font-semibold tabular-nums tracking-tight sm:text-[22px] ${item.tone}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

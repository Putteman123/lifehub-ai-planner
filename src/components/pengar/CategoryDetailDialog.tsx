import { useMemo } from "react";
import { Repeat, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { kr, type FixedExpenseRow, type SpendRow } from "@/lib/finance";
import { intervalLabel, dueMonthsInWindow, fixedDueExplanation } from "@/lib/fixed-expenses";
import { categoryBreakdown } from "@/lib/spend-breakdown";


function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, 1).toLocaleDateString("sv-SE", { month: "short" });
}

/** Detaljvy för en utgiftskategori: köp, fasta poster och månadstrend. */
export function CategoryDetailDialog({
  category,
  spends,
  fixed,
  days,
  onOpenChange,
}: {
  category: string | null;
  spends: SpendRow[];
  fixed: FixedExpenseRow[];
  days: number;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useMemo(() => {
    if (!category) return null;
    const { rows, fixedRows, spendTotal, fixedTotal } = categoryBreakdown(
      category,
      spends,
      fixed,
      days,
    );
    const months = Math.max(days / 30.44, 1);



    const byMonth = new Map<string, number>();
    for (const row of rows) {
      const k = monthKey(row.spent_at);
      byMonth.set(k, (byMonth.get(k) ?? 0) + Number(row.amount));
    }
    const bars = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const max = Math.max(...bars.map(([, v]) => v), 1);

    return {
      rows,
      fixedRows,
      spendTotal,
      fixedTotal,
      total: spendTotal + fixedTotal,
      perMonth: (spendTotal + fixedTotal) / months,
      bars,
      max,
    };
  }, [category, spends, fixed, days]);

  return (
    <TooltipProvider>
      <Dialog open={Boolean(category)} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{category}</DialogTitle>
          </DialogHeader>

          {!data ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Totalt", value: kr(data.total) },
                  { label: "Snitt/mån", value: kr(data.perMonth) },
                  { label: "Antal köp", value: String(data.rows.length) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="font-display text-base font-semibold tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>

              {data.bars.length > 1 ? (
                <div className="flex h-24 items-end gap-1.5">
                  {data.bars.map(([key, value]) => (
                    <div key={key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-primary/70"
                        style={{ height: `${Math.max((value / data.max) * 72, 3)}px` }}
                        title={kr(value)}
                      />
                      <span className="truncate text-[10px] text-muted-foreground">
                        {monthLabel(key)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {data.fixedRows.length ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Fasta utgifter i kategorin
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                          <Info className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs leading-relaxed">
                        Summan räknas utifrån vilka förfallodatum som faktiskt infaller inom perioden. Ett kvartalsvis avtal som startade i februari kommer t.ex. bara med en gång i ett 30-dagarsfönster som börjar i mars, men två gånger i ett fönster som täcker februari–mars.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ul className="space-y-1.5">
                    {data.fixedRows.map((row) => {
                      const due = dueMonthsInWindow(row, days);
                      return (
                        <li
                          key={row.id}
                          className="rounded-lg border border-border/70 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Repeat className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{row.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {intervalLabel(Number(row.interval_months ?? 1))}
                            </span>
                            <span className="shrink-0 text-sm font-medium tabular-nums">
                              {kr(Number(row.amount) * (due.length || 1))}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-6">
                            <span className="text-[11px] text-muted-foreground">
                              Förfallomånad:
                            </span>
                            {due.length ? (
                              due.map((key) => (
                                <span
                                  key={key}
                                  className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
                                >
                                  {monthLabel(key)} {key.slice(2, 4)}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                ingen i perioden
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              · {due.length} × {kr(Number(row.amount))}
                            </span>
                          </div>
                          <div className="pl-6 pt-1 text-[11px] leading-snug text-muted-foreground/80">
                            {fixedDueExplanation(row)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Köp i perioden</p>
                {data.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga registrerade köp här ännu.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.rows.slice(0, 60).map((row) => (
                      <li key={row.id} className="flex items-center gap-2 py-1 text-sm">
                        <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                          {row.spent_at.slice(5, 10)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{row.note ?? "Utgift"}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {kr(Number(row.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}


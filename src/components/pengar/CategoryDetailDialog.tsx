import { useMemo } from "react";
import { Repeat } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kr, type FixedExpenseRow, type SpendRow } from "@/lib/finance";
import { fixedAmountInWindow, intervalLabel } from "@/lib/fixed-expenses";

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
    const since = Date.now() - days * 86400000;
    const key = category.toLowerCase();
    const rows = spends
      .filter((row) => ((row.category ?? "").trim() || "Övrigt").toLowerCase() === key)
      .filter((row) => new Date(row.spent_at).getTime() >= since)
      .sort((a, b) => b.spent_at.localeCompare(a.spent_at));

    const fixedRows = fixed.filter(
      (row) => row.is_active && ((row.category ?? "").trim() || "Boende").toLowerCase() === key,
    );

    const spendTotal = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const months = Math.max(days / 30.44, 1);
    const fixedTotal = fixedRows.reduce((sum, r) => sum + fixedAmountInWindow(r, days), 0);


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
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Fasta utgifter i kategorin
                </p>
                <ul className="space-y-1.5">
                  {data.fixedRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
                    >
                      <Repeat className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {intervalLabel(Number(row.interval_months ?? 1))}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {kr(Number(row.amount))}
                      </span>
                    </li>
                  ))}
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
  );
}

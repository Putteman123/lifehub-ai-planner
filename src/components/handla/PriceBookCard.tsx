import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SectionCard } from "@/components/SectionCard";
import { Input } from "@/components/ui/input";
import { usePantryPrices } from "@/lib/shopping";
import type { PantryPrice } from "@/lib/shopping";

/** Färger till butiksserierna i grafen. */
const SERIES_COLORS = [
  "hsl(var(--cat-jobb))",
  "hsl(var(--cat-ledig))",
  "hsl(var(--cat-barn))",
  "hsl(var(--cat-privat))",
  "hsl(var(--cat-kvall))",
];

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type PriceGroup = {
  key: string;
  name: string;
  /** Nyast först. */
  rows: PantryPrice[];
  normal: PantryPrice[];
  campaigns: number;
  latest: PantryPrice;
  latestNormal: PantryPrice | null;
  min: number | null;
  max: number | null;
  trend: "up" | "down" | "flat" | null;
};

/**
 * Prisboken – alla priser Andrea läst av från kvitton, grupperade per vara.
 * Kampanjpriser visas men räknas aldrig som normalpris.
 */
export function PriceBookCard() {
  const pricesQ = usePantryPrices();
  const [query, setQuery] = useState("");

  const groups = useMemo<PriceGroup[]>(() => {
    const byKey = new Map<string, PantryPrice[]>();
    for (const row of pricesQ.data ?? []) {
      const list = byKey.get(row.name_key) ?? [];
      list.push(row);
      byKey.set(row.name_key, list);
    }
    const result: PriceGroup[] = [];
    for (const [key, rows] of byKey) {
      // rows är redan nyast först från frågan.
      const normal = rows.filter((r) => !r.is_campaign);
      const latestNormal = normal[0] ?? null;
      const prices = normal.map((r) => Number(r.price));
      let trend: PriceGroup["trend"] = null;
      if (normal.length > 1) {
        const diff = Number(normal[0]!.price) - Number(normal[1]!.price);
        trend = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat";
      }
      result.push({
        key,
        name: rows[0]!.name,
        rows,
        normal,
        campaigns: rows.length - normal.length,
        latest: rows[0]!,
        latestNormal,
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null,
        trend,
      });
    }
    return result.sort(
      (a, b) =>
        new Date(b.latest.purchased_at).getTime() - new Date(a.latest.purchased_at).getTime(),
    );
  }, [pricesQ.data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(needle));
  }, [groups, query]);

  return (
    <SectionCard
      title="Prisboken"
      icon={Tag}
      accent="text-cat-kvall"
      tint="bg-cat-kvall/12"
      count={groups.length}
      collapsible
    >
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Priserna fylls på automatiskt varje gång du scannar ett kvitto. Kampanjpriser sparas men
          räknas inte som normalpris.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök vara, t.ex. mjölk…"
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Inga noterade priser matchar ”{query}”.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {filtered.map((g) => (
                <li
                  key={g.key}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{g.name}</span>
                      {g.campaigns > 0 ? (
                        <span className="rounded-md bg-cat-kvall/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cat-kvall">
                          {g.campaigns} kampanj
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {g.latestNormal ? (
                        <>
                          {g.latestNormal.merchant ?? "Okänd butik"} ·{" "}
                          {dateFmt.format(new Date(g.latestNormal.purchased_at))}
                          {g.min !== null && g.max !== null && g.min !== g.max ? (
                            <>
                              {" "}
                              · span {Math.round(g.min)}–{Math.round(g.max)} kr
                            </>
                          ) : null}
                        </>
                      ) : (
                        "Bara kampanjpriser noterade"
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {g.trend === "up" ? (
                      <ArrowUpRight className="size-4 text-destructive" aria-label="Dyrare" />
                    ) : g.trend === "down" ? (
                      <ArrowDownRight className="size-4 text-cat-ledig" aria-label="Billigare" />
                    ) : g.trend === "flat" ? (
                      <Minus className="size-4 text-muted-foreground" aria-label="Oförändrat" />
                    ) : null}
                    {g.latestNormal ? (
                      <span className="text-sm font-semibold tabular-nums">
                        {Math.round(Number(g.latestNormal.price))} kr
                      </span>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {Math.round(Number(g.latest.price))} kr*
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {groups.some((g) => !g.latestNormal) ? (
            <p className="mt-3 text-[11px] text-muted-foreground">* Kampanjpris</p>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

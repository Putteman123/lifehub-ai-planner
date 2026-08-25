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
  "var(--cat-ekonomi)",
  "var(--cat-iptv)",
  "var(--cat-privat)",
  "var(--cat-jurist)",
  "var(--cat-viktigt)",
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

const shortFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" });

/**
 * Prisutveckling för en vara: en linje per butik med normalpris över tid,
 * och kampanjköpen utmarkerade som fristående punkter.
 */
function PriceTrendChart({ group }: { group: PriceGroup }) {
  const { data, merchants, campaigns } = useMemo(() => {
    const rows = [...group.rows].sort(
      (a, b) => new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime(),
    );
    const merchantList = Array.from(
      new Set(rows.filter((r) => !r.is_campaign).map((r) => r.merchant ?? "Okänd butik")),
    ).slice(0, SERIES_COLORS.length);

    const byTime = new Map<number, Record<string, number | string>>();
    for (const row of rows) {
      const t = new Date(row.purchased_at).getTime();
      const point = byTime.get(t) ?? { t };
      const merchant = row.merchant ?? "Okänd butik";
      if (!row.is_campaign && merchantList.includes(merchant)) {
        point[merchant] = Number(row.price);
      }
      byTime.set(t, point);
    }

    return {
      data: Array.from(byTime.values()).sort((a, b) => Number(a["t"]) - Number(b["t"])),
      merchants: merchantList,
      campaigns: rows.filter((r) => r.is_campaign),
    };
  }, [group]);

  if (group.rows.length < 2) {
    return (
      <p className="px-2 pb-2 text-xs text-muted-foreground">
        För få prisnoteringar för en graf – ett köp till så ritas kurvan.
      </p>
    );
  }

  return (
    <div className="pb-2">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(v: number) => shortFmt.format(new Date(v))}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v)}`}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(v) => dateFmt.format(new Date(Number(v)))}
              formatter={(value: number, name: string) => [`${Number(value).toFixed(2)} kr`, name]}
            />
            {merchants.map((merchant, i) => (
              <Line
                key={merchant}
                type="monotone"
                dataKey={merchant}
                name={merchant}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
            {campaigns.map((row) => (
              <ReferenceDot
                key={row.id}
                x={new Date(row.purchased_at).getTime()}
                y={Number(row.price)}
                r={4}
                fill="var(--cat-kvall)"
                stroke="var(--card)"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[10px] text-muted-foreground">
        {merchants.map((merchant, i) => (
          <span key={merchant} className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            {merchant}
          </span>
        ))}
        {campaigns.length ? (
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-cat-kvall" />
            Kampanjköp ({campaigns.length})
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Prisboken – alla priser Andrea läst av från kvitton, grupperade per vara.
 * Kampanjpriser visas men räknas aldrig som normalpris.
 */
export function PriceBookCard() {
  const pricesQ = usePantryPrices();
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

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
                <li key={g.key} className="rounded-xl">
                <button
                  type="button"
                  aria-expanded={openKey === g.key}
                  onClick={() => setOpenKey((k) => (k === g.key ? null : g.key))}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60"
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
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform ${
                        openKey === g.key ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {openKey === g.key ? <PriceTrendChart group={g} /> : null}
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

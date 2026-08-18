import { CalendarClock, ChevronDown, Plus, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionCard } from "@/components/SectionCard";
import type { Tables } from "@/integrations/supabase/types";

type PantryRow = Tables<"pantry_items">;

const MEDAL = ["text-cat-jurist", "text-muted-foreground", "text-cat-kvall"];

const dateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmt(iso: string | null) {
  if (!iso) return null;
  return dateFmt.format(new Date(iso));
}

function daysAgo(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** Snittintervall mellan köpen, beräknat på första och senaste tillfället. */
function avgInterval(row: PantryRow) {
  const first = new Date(row.created_at).getTime();
  const last = new Date(row.last_purchased_at ?? row.last_added_at).getTime();
  if (row.times_added < 2 || last <= first) return null;
  return Math.round((last - first) / 86_400_000 / (row.times_added - 1));
}

/** Topplista över de varor som oftast hamnar i inköpslistan. */
export function PantryTopCard({
  pantry,
  onPick,
}: {
  pantry: PantryRow[];
  onPick?: (name: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Varianter av samma vara ("Iste", "Iste citron/lime") slås ihop till en rad.
  const top = useMemo(() => {
    const groups = new Map<string, PantryRow>();
    for (const row of pantry) {
      if (row.times_added <= 0 || isNonGrocery(row.name)) continue;
      const key = canonicalKey(row.name);
      const current = groups.get(key);
      if (!current) {
        groups.set(key, { ...row });
        continue;
      }
      const winner = row.times_added > current.times_added ? row : current;
      groups.set(key, {
        ...winner,
        times_added: current.times_added + row.times_added,
        created_at:
          new Date(row.created_at) < new Date(current.created_at)
            ? row.created_at
            : current.created_at,
        last_added_at:
          new Date(row.last_added_at) > new Date(current.last_added_at)
            ? row.last_added_at
            : current.last_added_at,
        last_purchased_at:
          new Date(row.last_purchased_at ?? 0) > new Date(current.last_purchased_at ?? 0)
            ? row.last_purchased_at
            : current.last_purchased_at,
      });
    }
    return [...groups.values()].sort((a, b) => b.times_added - a.times_added).slice(0, 10);
  }, [pantry]);


  const max = top[0]?.times_added ?? 1;


  return (
    <SectionCard
      title="Topplista i skafferiet"
      icon={Trophy}
      accent="text-cat-jurist"
      tint="bg-cat-jurist/12"
      count={top.length}
      collapsible
    >
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          När du handlat några gånger dyker dina vanligaste varor upp här.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((row, i) => {
            const isOpen = openId === row.id;
            const since = daysAgo(row.last_purchased_at);
            const interval = avgInterval(row);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : row.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`w-5 shrink-0 text-sm font-semibold tabular-nums ${MEDAL[i] ?? "text-muted-foreground"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="mt-1 block h-1.5 rounded-full bg-muted">
                      <span
                        className="block h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (row.times_added / max) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {row.times_added} ggr
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen ? (
                  <div className="ml-8 mt-1 space-y-2 rounded-xl bg-muted/50 p-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Senast köpt</dt>
                        <dd className="mt-0.5 font-medium">
                          {fmt(row.last_purchased_at) ?? "Okänt"}
                          {since !== null ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({since === 0 ? "idag" : `${since} d sedan`})
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Senast i listan</dt>
                        <dd className="mt-0.5 font-medium">{fmt(row.last_added_at) ?? "–"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Antal köp</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{row.times_added} ggr</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Snittintervall</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">
                          {interval !== null ? `var ${interval}:e dag` : "för få köp"}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Först sparad</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                          <CalendarClock className="size-3.5 text-muted-foreground" />
                          {fmt(row.created_at)}
                          <span className="font-normal text-muted-foreground">
                            · {row.source === "ai" ? "från kvitto" : "manuellt"}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {onPick ? (
                      <button
                        type="button"
                        onClick={() => onPick(row.name)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      >
                        <Plus className="size-3.5" />
                        Lägg i listan
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

      )}
    </SectionCard>
  );
}

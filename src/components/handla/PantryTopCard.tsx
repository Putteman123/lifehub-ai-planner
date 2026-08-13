import { Trophy } from "lucide-react";
import { useMemo } from "react";

import { SectionCard } from "@/components/SectionCard";
import type { Tables } from "@/integrations/supabase/types";

type PantryRow = Tables<"pantry_items">;

const MEDAL = ["text-cat-jurist", "text-muted-foreground", "text-cat-kvall"];

/** Topplista över de varor som oftast hamnar i inköpslistan. */
export function PantryTopCard({
  pantry,
  onPick,
}: {
  pantry: PantryRow[];
  onPick?: (name: string) => void;
}) {
  const top = useMemo(
    () =>
      [...pantry]
        .filter((row) => row.times_added > 0)
        .sort((a, b) => b.times_added - a.times_added)
        .slice(0, 10),
    [pantry],
  );

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
          {top.map((row, i) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onPick?.(row.name)}
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
              </button>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

import { useMemo } from "react";
import { PackageCheck, Plus, Tag } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { isNonGrocery } from "@/lib/pantry-name";
import { usePantryPrices } from "@/lib/shopping";

type PantryRow = Tables<"pantry_items">;

type Suggestion = {
  id: string;
  name: string;
  /** Snittdagar mellan köpen. */
  interval: number;
  /** Dagar sedan senaste köpet. */
  since: number;
  /** Negativt = tar snart slut, positivt = redan försenat. */
  overdue: number;
  price: number | null;
  merchant: string | null;
  campaign: boolean;
};

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function intervalDays(row: PantryRow) {
  const first = new Date(row.created_at).getTime();
  const last = new Date(row.last_purchased_at ?? row.last_added_at).getTime();
  if (row.times_added < 2 || last <= first) return null;
  return Math.round((last - first) / 86_400_000 / (row.times_added - 1));
}

/**
 * Föreslår påfyllning: varor vars normala köpintervall snart löper ut,
 * kombinerat med billigaste kända pris ur prisboken.
 */
export function RestockCard({
  pantry,
  onAdd,
}: {
  pantry: PantryRow[];
  onAdd: (names: string[]) => void;
}) {
  const pricesQ = usePantryPrices();

  /** Billigaste kända pris per varunyckel de senaste 60 dagarna. */
  const cheapest = useMemo(() => {
    const cutoff = Date.now() - 60 * 86_400_000;
    const map = new Map<string, { price: number; merchant: string | null; campaign: boolean }>();
    for (const row of pricesQ.data ?? []) {
      if (new Date(row.purchased_at).getTime() < cutoff) continue;
      const current = map.get(row.name_key);
      const price = Number(row.price);
      if (!current || price < current.price) {
        map.set(row.name_key, { price, merchant: row.merchant, campaign: row.is_campaign });
      }
    }
    return map;
  }, [pricesQ.data]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    for (const row of pantry) {
      if (isNonGrocery(row.name)) continue;
      const interval = intervalDays(row);
      if (!interval || interval < 2) continue;
      const last = new Date(row.last_purchased_at ?? row.last_added_at).getTime();
      const since = Math.floor((Date.now() - last) / 86_400_000);
      const overdue = since - interval;
      // Ta med det som tar slut inom tre dagar eller redan borde vara påfyllt.
      if (overdue < -3) continue;
      const price = cheapest.get(row.name_key);
      out.push({
        id: row.id,
        name: row.name,
        interval,
        since,
        overdue,
        price: price?.price ?? null,
        merchant: price?.merchant ?? null,
        campaign: price?.campaign ?? false,
      });
    }
    return out.sort((a, b) => b.overdue - a.overdue).slice(0, 8);
  }, [pantry, cheapest]);

  if (suggestions.length === 0) return null;

  return (
    <SectionCard
      title="Dags att fylla på"
      icon={PackageCheck}
      accent="text-nav-handla"
      tint="bg-nav-handla/12"
      count={suggestions.length}
      action={
        <Button size="sm" variant="secondary" onClick={() => onAdd(suggestions.map((s) => s.name))}>
          Lägg till alla
        </Button>
      }
    >
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.name}</span>
                {s.campaign ? (
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="size-3" /> kampanj
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Köps ungefär var {s.interval}:e dag · {s.since} dagar sedan
                {s.price !== null
                  ? ` · billigast ${kr(s.price)} kr${s.merchant ? ` på ${s.merchant}` : ""}`
                  : ""}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={() => onAdd([s.name])}
              aria-label={`Lägg till ${s.name}`}
            >
              <Plus className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

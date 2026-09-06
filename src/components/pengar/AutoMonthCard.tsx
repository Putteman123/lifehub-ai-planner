import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { kr, type FixedExpenseRow, type IncomeRow, type SpendRow } from "@/lib/finance";
import {
  addMonths,
  detectRecurringIncomes,
  detectRecurringSpends,
  labelKey,
  planIncomes,
  type PlannedIncome,
} from "@/lib/income-recurrence";

function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

/**
 * Skriver fram återkommande inbetalningar till innevarande och nästa månad,
 * och föreslår köp som återkommer varje månad som fasta utgifter.
 */
export function AutoMonthCard({
  incomes,
  spends,
  fixed,
  className,
}: {
  incomes: IncomeRow[];
  spends: SpendRow[];
  fixed: FixedExpenseRow[];
  className?: string;
}) {
  const qc = useQueryClient();
  const ran = useRef(false);

  const month = currentMonth();
  const months = useMemo(() => [month, addMonths(month, 1)], [month]);

  const templates = useMemo(() => detectRecurringIncomes(incomes), [incomes]);
  const planned = useMemo(
    () => planIncomes(incomes, templates, months),
    [incomes, templates, months],
  );

  const fixedKeys = useMemo(() => new Set(fixed.map((row) => labelKey(row.name))), [fixed]);
  const suggestions = useMemo(
    () => detectRecurringSpends(spends).filter((row) => !fixedKeys.has(row.key)).slice(0, 4),
    [spends, fixedKeys],
  );

  const createIncomes = useMutation({
    mutationFn: async (rows: PlannedIncome[]) => {
      if (rows.length === 0) return 0;
      const user_id = await userId();
      const { error } = await supabase
        .from("finance_incomes")
        .insert(rows.map((row) => ({ ...row, user_id })));
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: (count) => {
      if (!count) return;
      qc.invalidateQueries({ queryKey: ["finance_incomes"] });
      toast.success(`${count} inbetalning${count === 1 ? "" : "ar"} framskrivna`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addFixed = useMutation({
    mutationFn: async (row: { label: string; amount: number; day: number; category: string | null }) => {
      const user_id = await userId();
      const { error } = await supabase.from("fixed_expenses").insert({
        user_id,
        name: row.label,
        amount: row.amount,
        due_day: Math.min(Math.max(row.day, 1), 28),
        category: row.category,
        is_active: true,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixed_expenses"] });
      toast.success("Tillagd som fast utgift");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Skriv fram automatiskt en gång per månad.
  useEffect(() => {
    if (ran.current || planned.length === 0 || typeof window === "undefined") return;
    const key = `auto-month:${month}`;
    if (window.localStorage.getItem(key)) return;
    ran.current = true;
    window.localStorage.setItem(key, "1");
    createIncomes.mutate(planned);
  }, [planned, month, createIncomes]);

  if (templates.length === 0 && suggestions.length === 0) return null;

  return (
    <SectionCard
      title="Automatisk månad"
      icon={Repeat}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      {...(className ? { className } : {})}
      action={
        planned.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={createIncomes.isPending}
            onClick={() => createIncomes.mutate(planned)}
          >
            Skriv fram {planned.length}
          </Button>
        ) : null
      }
    >
      <p className="text-sm text-muted-foreground">
        {planned.length > 0
          ? `${planned.length} post${planned.length === 1 ? "" : "er"} saknas för ${months.join(" och ")}.`
          : "Månadens återkommande inbetalningar är redan på plats."}
      </p>

      {templates.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {templates.slice(0, 6).map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                den {row.day} · {row.months.length} mån
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-cat-ledig">
                +{kr(row.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5" /> Köp som återkommer varje månad
          </p>
          <ul className="space-y-1.5">
            {suggestions.map((row) => (
              <li
                key={row.key}
                className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{kr(row.amount)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  disabled={addFixed.isPending}
                  onClick={() =>
                    addFixed.mutate({
                      label: row.label,
                      amount: row.amount,
                      day: row.day,
                      category: row.category,
                    })
                  }
                >
                  <Plus className="size-4" /> Fast
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

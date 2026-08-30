import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getWeeklyReview } from "@/lib/weekly-review.functions";

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

/** Andreas veckoavstämning: pengar, obetalt och vad nästa vecka kräver. */
export function WeeklyReviewCard() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["weekly_review"],
    queryFn: () => getWeeklyReview(),
    staleTime: 1000 * 60 * 60 * 6,
  });

  const addTodo = useMutation({
    mutationFn: async (title: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Inte inloggad.");
      const { error } = await supabase
        .from("todos")
        .insert({ user_id: auth.user.id, title, is_done: false });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Tillagd i Att göra.");
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;
  const diff = data ? data.spent - data.spentPrev : 0;

  return (
    <SectionCard
      title="Veckoavstämning"
      icon={CalendarCheck}
      accent="text-nav-pengar"
      tint="bg-nav-pengar/12"
      action={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          aria-label="Uppdatera"
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Andrea räknar ihop veckan…</p>
      ) : q.error ? (
        <p className="text-sm text-muted-foreground">
          Kunde inte hämta avstämningen just nu.
        </p>
      ) : data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="card-soft p-3">
              <p className="text-xs text-muted-foreground">Denna vecka</p>
              <p className="text-lg font-semibold">{kr(data.spent)}</p>
            </div>
            <div className="card-soft p-3">
              <p className="text-xs text-muted-foreground">Mot förra veckan</p>
              <p
                className={`text-lg font-semibold ${diff > 0 ? "text-destructive" : "text-nav-handla"}`}
              >
                {diff >= 0 ? "+" : ""}
                {kr(diff)}
              </p>
            </div>
          </div>

          {data.topCategories.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {data.topCategories.map((c) => (
                <li key={c.category} className="flex justify-between gap-3">
                  <span className="truncate text-muted-foreground">{c.category}</span>
                  <span className="shrink-0 tabular-nums">{kr(c.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {data.unpaidFixed.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Obetalt denna månad:{" "}
              <span className="text-foreground">
                {data.unpaidFixed.map((f) => f.name).join(", ")}
              </span>
            </p>
          ) : null}

          {data.summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.summary}</p>
          ) : null}

          {data.actions.length > 0 ? (
            <ul className="space-y-2">
              {data.actions.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-2 rounded-2xl border border-border/70 bg-card/60 p-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1">{a}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={() => addTodo.mutate(a)}
                    aria-label="Lägg till som uppgift"
                  >
                    <Plus className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

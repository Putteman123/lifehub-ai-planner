import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PiggyBank, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { moneyCoach } from "@/lib/briefing.functions";

/** Kort AI-råd om vad pengarna räcker till just nu. */
export function MoneyCoachCard() {
  const run = useServerFn(moneyCoach);
  const q = useQuery({
    queryKey: ["money_coach", new Date().toDateString()],
    queryFn: () => run({}),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  return (
    <section className="rounded-[20px] border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PiggyBank className="size-4 text-primary" /> Ekonomicoach
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          aria-label="Uppdatera råd"
        >
          {q.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
        {q.isLoading
          ? "Räknar på månaden…"
          : q.isError
            ? "Kunde inte räkna just nu. Försök igen om en stund."
            : (q.data?.text ?? "")}
      </p>

      {q.data ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {q.data.perDay.toLocaleString("sv-SE")} kr/dag i {q.data.daysLeft} dagar ·{" "}
          {q.data.free.toLocaleString("sv-SE")} kr kvar efter fasta utgifter
        </p>
      ) : null}
    </section>
  );
}

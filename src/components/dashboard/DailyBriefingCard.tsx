import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dailyBriefing } from "@/lib/briefing.functions";

/** Andreas korta morgonbriefing högst upp på startsidan. */
export function DailyBriefingCard() {
  const run = useServerFn(dailyBriefing);
  const q = useQuery({
    queryKey: ["daily_briefing", new Date().toDateString()],
    queryFn: () => run({}),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  return (
    <section className="rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> Andreas briefing
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          aria-label="Uppdatera briefing"
        >
          {q.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
        {q.isLoading
          ? "Andrea läser igenom dagen…"
          : q.isError
            ? "Andrea kunde inte sammanfatta dagen just nu. Försök igen om en stund."
            : (q.data?.text ?? "Inget att rapportera i dag.")}
      </p>

      {q.data ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {q.data.eventCount} aktiviteter · {q.data.todoCount} uppgifter ·{" "}
          {q.data.balance.toLocaleString("sv-SE")} kr på kontona
        </p>
      ) : null}
    </section>
  );
}

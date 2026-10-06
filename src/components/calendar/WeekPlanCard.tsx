import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Lightbulb } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/calendar";
import type { EventRow } from "@/lib/categories";
import { useTodos } from "@/lib/db";
import { describeSlots, findFreeSlots } from "@/lib/free-slots";
import { fmtLocal } from "@/lib/tz";
import { getWeekPlan } from "@/lib/week-plan.functions";

const LABEL: Record<string, string> = {
  google: "Via din Gemini-nyckel",
  lovable: "Via Google Gemini",
  openai: "Via ChatGPT",
  perplexity: "Via Perplexity",
};

/** Veckoplanerare: Gemini lägger kommande 7 dagar utifrån kalender och uppgifter. */
export function WeekPlanCard({ events }: { events: EventRow[] }) {
  const todosQ = useTodos();
  const run = useServerFn(getWeekPlan);

  const payload = useMemo(() => {
    const now = Date.now();
    const end = now + 7 * 864e5;
    const week = events
      .filter((e) => new Date(e.ends_at).getTime() > now && new Date(e.starts_at).getTime() < end)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 80)
      .map((e) =>
        e.all_day
          ? `${fmt(e.starts_at, "EEE d MMM")} heldag: ${e.title}`
          : `${fmt(e.starts_at, "EEE d MMM HH:mm")}–${fmt(e.ends_at, "HH:mm")}: ${e.title}`,
      )
      .join("\n");
    const todos = (todosQ.data ?? [])
      .filter((t) => !t.is_done)
      .slice(0, 30)
      .map((t) => `${t.title}${t.due_date ? ` (deadline ${fmtLocal(t.due_date)})` : ""}`)
      .join("\n");
    return {
      events: week,
      todos,
      slots: describeSlots(findFreeSlots(events, 7)),
      today: fmt(new Date(), "EEEE d MMMM yyyy"),
    };
  }, [events, todosQ.data]);

  const plan = useMutation({
    mutationFn: () => run({ data: payload }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <CalendarRange className="size-4 text-primary" /> Veckoplanerare
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Andrea lägger dina uppgifter i veckans lediga tider.
          </p>
        </div>
        <Button size="sm" onClick={() => plan.mutate()} disabled={plan.isPending}>
          {plan.isPending ? "Planerar…" : plan.data ? "Planera om" : "Planera veckan"}
        </Button>
      </div>

      {plan.data ? (
        <div className="mt-4 space-y-3">
          {plan.data.summary ? <p className="text-sm">{plan.data.summary}</p> : null}
          <ol className="grid gap-2 sm:grid-cols-2">
            {plan.data.days.map((d, i) => (
              <li key={i} className="rounded-xl border border-border/70 p-3">
                <p className="text-sm font-semibold capitalize">{d.day}</p>
                <p className="text-xs text-muted-foreground">{d.focus}</p>
                {d.blocks.length ? (
                  <ul className="mt-2 space-y-1">
                    {d.blocks.map((b, j) => (
                      <li key={j} className="flex gap-2 text-xs">
                        <span className="shrink-0 font-medium tabular-nums text-primary">{b.time}</span>
                        <span>{b.task}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
          {plan.data.tips.length ? (
            <ul className="space-y-1">
              {plan.data.tips.map((t, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-muted-foreground">{LABEL[plan.data.provider] ?? ""}</p>
        </div>
      ) : null}
    </section>
  );
}

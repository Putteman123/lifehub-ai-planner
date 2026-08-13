import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useEvents } from "@/lib/db";
import { describeSlots, findFreeSlots } from "@/lib/free-slots";
import { getTodoPlan } from "@/lib/todo-suggest.functions";
import type { TodoRow } from "@/lib/todos";
import { fmtLocal } from "@/lib/tz";

export function TodoPlanCard({ todos }: { todos: TodoRow[] }) {
  const eventsQ = useEvents();
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);

  const slots = useMemo(() => findFreeSlots(events, 7), [events]);
  const totalFreeH = Math.round(slots.reduce((sum, s) => sum + s.minutes, 0) / 60);

  const run = useServerFn(getTodoPlan);
  const plan = useMutation({
    mutationFn: () =>
      run({
        data: {
          todos: todos
            .slice(0, 30)
            .map(
              (t) =>
                `[${t.id}] ${t.title}${t.due_date ? ` – deadline ${fmtLocal(t.due_date)}` : " – ingen deadline"}${t.notes ? ` – ${t.notes.replace(/\s+/g, " ").slice(0, 120)}` : ""}`,
            )
            .join("\n"),
          slots: describeSlots(slots),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);
  const items = (plan.data?.items ?? []).filter((i) => byId.has(i.todoId));

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Andreas förslag
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {slots.length
              ? `Ca ${totalFreeH} h ledigt i kalendern kommande 7 dagar.`
              : "Inga lediga luckor hittades kommande 7 dagar."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={plan.isPending || !todos.length || !slots.length}
          onClick={() => plan.mutate()}
        >
          {plan.isPending ? "Planerar…" : "Vad ska jag ta?"}
        </Button>
      </div>

      {plan.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Andrea matchar uppgifter mot din tid…</p>
      ) : null}

      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.todoId}-${i}`}
              className="rounded-xl border border-border/70 px-3 py-2.5"
            >
              <p className="text-sm font-medium">{byId.get(item.todoId)?.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                <CalendarClock className="size-3.5" />
                {item.slot} · {Math.round(item.minutes)} min
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {plan.data?.note && items.length ? (
        <p className="mt-3 text-xs text-muted-foreground">{plan.data.note}</p>
      ) : null}

      {plan.isSuccess && !items.length && !plan.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Andrea hittade ingen uppgift som passar i luckorna just nu.
        </p>
      ) : null}
    </section>
  );
}

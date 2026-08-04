import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { AiPanel } from "@/components/AiPanel";
import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { categoryMeta, type EventRow } from "@/lib/categories";
import {
  addDays,
  dayLoad,
  endOfDay,
  eventsOnDay,
  fmt,
  freeGaps,
  LOAD_STYLES,
  mergeDuplicates,
  monthGrid,
  startOfDay,
  timeRange,
  totalHours,
  weekDays,
} from "@/lib/calendar";
import { useCaseTasks, useEvents, useReminders } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Översikt – LifeHub AI" },
      { name: "description", content: "Dagens agenda, veckans plan, ledig tid och AI-sammanfattning." },
      { property: "og:title", content: "Översikt – LifeHub AI" },
      { property: "og:description", content: "Din dag, vecka och månad i en enda vy." },
    ],
  }),
  component: Dashboard,
});

function aiSummary(events: EventRow[], today: Date) {
  const items = eventsOnDay(events, today).filter((e) => !e.all_day);
  if (items.length === 0) return "Du har inga inplanerade aktiviteter idag. Hela dagen är ledig.";
  const parts: string[] = [];
  const work = items.find((e) => e.category === "jobb");
  if (work) parts.push(`Idag arbetar du till ${fmt(work.ends_at, "HH:mm")}.`);
  const rest = items.filter((e) => e !== work);
  if (rest.length) {
    parts.push(
      `Därefter har du ${rest
        .map((e) => `${e.title} klockan ${fmt(e.starts_at, "HH:mm")}`)
        .join(" och ")}.`,
    );
  }
  const gaps = freeGaps(events, today, 30);
  const biggest = gaps.sort((a, b) => b.minutes - a.minutes)[0];
  if (biggest) {
    parts.push(
      `Du har cirka ${biggest.minutes} minuter ledig tid mellan ${fmt(biggest.start, "HH:mm")} och ${fmt(biggest.end, "HH:mm")}.`,
    );
  }
  const overlaps = items.filter((e, i) =>
    items.some(
      (o, j) =>
        i !== j &&
        new Date(e.starts_at) < new Date(o.ends_at) &&
        new Date(o.starts_at) < new Date(e.ends_at),
    ),
  );
  if (overlaps.length) parts.push("Obs: två aktiviteter krockar i tid.");
  return parts.join(" ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function EventRowItem({ event, onClick }: { event: EventRow; onClick: () => void }) {
  const meta = categoryMeta(event.category);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border-l-2 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-accent ${meta.bar}`}
    >
      <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
        {timeRange(event)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{event.title}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${meta.chip}`}>
        {meta.label}
      </span>
    </button>
  );
}

function Dashboard() {
  const eventsQ = useEvents();
  const rawEvents = eventsQ.data ?? [];
  const tasksQ = useCaseTasks();
  const tasks = tasksQ.data ?? [];
  const remindersQ = useReminders();
  const reminders = remindersQ.data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);

  const events = useMemo(() => mergeDuplicates(rawEvents), [rawEvents]);
  const today = useMemo(() => new Date(), []);
  const week = weekDays(today);
  const month = monthGrid(today);

  const todayEvents = eventsOnDay(events, today);
  const summary = aiSummary(events, today);
  const gaps = freeGaps(events, today, 30);

  const weekStart = startOfDay(week[0]!);
  const weekEnd = endOfDay(week[6]!);
  const inWeek = (e: EventRow) =>
    new Date(e.starts_at) >= weekStart && new Date(e.starts_at) <= weekEnd;

  const upcoming = events
    .filter((e) => new Date(e.starts_at) > today)
    .slice(0, 5);
  const deadlines = tasks.filter((t) => !t.is_done && t.due_date).slice(0, 4);
  const openReminders = reminders.filter((r) => !r.is_done).slice(0, 4);

  function open(event: EventRow | null) {
    setSelected(event);
    setDialogOpen(true);
  }

  return (
    <AppShell
      title="Översikt"
      subtitle={fmt(today, "EEEE d MMMM yyyy")}
      actions={
        <Button size="sm" onClick={() => open(null)}>
          <Plus className="size-4" /> Ny händelse
        </Button>
      }
    >
      <DataGate queries={[eventsQ, tasksQ, remindersQ]}>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-soft bg-accent/40 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-4" />
              <h2 className="text-sm font-semibold">Dagens sammanfattning</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{summary}</p>
          </section>

          <AiPanel />


          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Idag</h2>
            <div className="mt-3 space-y-2">
              {todayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga aktiviteter idag.</p>
              ) : (
                todayEvents.map((e) => (
                  <EventRowItem key={e.id} event={e} onClick={() => open(e)} />
                ))
              )}
            </div>
          </section>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Veckans agenda</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {week.map((day) => {
                const load = dayLoad(events, day);
                const items = eventsOnDay(events, day);
                return (
                  <div key={day.toISOString()} className="rounded-lg bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize">
                        {fmt(day, "EEEE d/M")}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[11px] ${LOAD_STYLES[load].text}`}
                      >
                        <span className={`size-2 rounded-full ${LOAD_STYLES[load].dot}`} />
                        {LOAD_STYLES[load].label}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {items.slice(0, 3).map((e) => (
                        <li key={e.id} className="flex items-center gap-2 text-xs">
                          <span className={`size-1.5 rounded-full ${categoryMeta(e.category).dot}`} />
                          <span className="truncate">{e.title}</span>
                        </li>
                      ))}
                      {items.length === 0 ? (
                        <li className="text-xs text-muted-foreground">Ledig</li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold capitalize">{fmt(today, "MMMM yyyy")}</h2>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
              {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {month.map((day) => {
                const items = eventsOnDay(events, day);
                const isToday = fmt(day, "yyyy-MM-dd") === fmt(today, "yyyy-MM-dd");
                const otherMonth = day.getMonth() !== today.getMonth();
                return (
                  <div
                    key={day.toISOString()}
                    className={`aspect-square rounded-md p-1 text-[11px] ${
                      isToday ? "bg-primary/10 font-semibold text-primary" : "bg-surface"
                    } ${otherMonth ? "opacity-40" : ""}`}
                  >
                    {fmt(day, "d")}
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {items.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`size-1.5 rounded-full ${categoryMeta(e.category).dot}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Arbetade timmar (v)"
              value={`${totalHours(events.filter(inWeek), (e) => e.category === "jobb").toFixed(0)} h`}
            />
            <Stat
              label="Juristtimmar (v)"
              value={`${totalHours(events.filter(inWeek), (e) => e.category === "jurist").toFixed(0)} h`}
            />
            <Stat
              label="Tid med barnen (v)"
              value={`${totalHours(events.filter(inWeek), (e) => e.category === "barn").toFixed(0)} h`}
            />
            <Stat
              label="Möten (v)"
              value={`${events.filter((e) => inWeek(e) && !e.all_day).length}`}
            />
          </div>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Ledig tid idag</h2>
            <ul className="mt-3 space-y-2">
              {gaps.length === 0 ? (
                <li className="text-sm text-muted-foreground">Ingen lucka hittad.</li>
              ) : (
                gaps.map((g) => (
                  <li
                    key={g.start.toISOString()}
                    className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"
                  >
                    <span className="tabular-nums">
                      {fmt(g.start, "HH:mm")}–{fmt(g.end, "HH:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">{g.minutes} min</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Kommande viktiga händelser</h2>
            <ul className="mt-3 space-y-2">
              {upcoming.length === 0 ? (
                <li className="text-sm text-muted-foreground">Inget planerat framåt.</li>
              ) : (
                upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className={`size-2 rounded-full ${categoryMeta(e.category).dot}`} />
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmt(e.starts_at, "d MMM HH:mm")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Deadlines</h2>
            <ul className="mt-3 space-y-2">
              {deadlines.length === 0 ? (
                <li className="text-sm text-muted-foreground">Inga tidsfrister.</li>
              ) : (
                deadlines.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t.due_date ? fmt(t.due_date, "d MMM") : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-soft p-5">
            <h2 className="text-sm font-semibold">Påminnelser</h2>
            <ul className="mt-3 space-y-2">
              {openReminders.length === 0 ? (
                <li className="text-sm text-muted-foreground">Inga påminnelser.</li>
              ) : (
                openReminders.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmt(r.remind_at, "d MMM HH:mm")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selected}
        defaultDate={addDays(today, 0)}
      />
      </DataGate>
    </AppShell>
  );
}

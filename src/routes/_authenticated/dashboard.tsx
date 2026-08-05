import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Sparkles, AlertTriangle, Clock, Calendar } from "lucide-react";

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
  overlapsOnDay,
  startOfDay,
  timeRange,
  totalHours,
  weekDays,
} from "@/lib/calendar";
import { useCaseTasks, useEvents, usePlaces, useReminders, useTodos, useVisits } from "@/lib/db";
import {
  PLACE_KINDS,
  formatDuration,
  minutesByKind,
  startOfDay as dayStart,
  startOfWeek,
  visitLabel,
  visitMinutes,
} from "@/lib/geo";

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-soft p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function PlaceCard() {
  const placesQ = usePlaces();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const visitsQ = useVisits(weekStart.toISOString());
  const places = placesQ.data ?? [];
  const visits = visitsQ.data ?? [];
  const openVisit = visits.find((v) => !v.left_at) ?? null;
  const todayMinutes = minutesByKind(visits, places, dayStart(now), now, now);
  const active = PLACE_KINDS.filter((k) => todayMinutes[k.value] > 0);

  return (
    <section className="card-soft p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Platslogg idag</h2>
        <QuickLink to="/platser">Öppna</QuickLink>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {openVisit
          ? `Just nu: ${visitLabel(openVisit, places)} · ${formatDuration(visitMinutes(openVisit, now))}`
          : "Ingen pågående plats registrerad."}
      </p>
      {active.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {active.map((k) => (
            <li key={k.value} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: k.color }} />
                {k.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatDuration(todayMinutes[k.value])}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Dashboard() {
  const eventsQ = useEvents();
  const rawEvents = eventsQ.data ?? [];
  const tasksQ = useCaseTasks();
  const tasks = tasksQ.data ?? [];
  const todosQ = useTodos();
  const todos = todosQ.data ?? [];
  const remindersQ = useReminders();
  const reminders = remindersQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);

  const events = useMemo(() => mergeDuplicates(rawEvents), [rawEvents]);
  const today = useMemo(() => new Date(), []);
  const week = weekDays(today);
  const month = monthGrid(today);

  const todayEvents = eventsOnDay(events, today);
  const overlaps = overlapsOnDay(events, today);
  const gaps = freeGaps(events, today, 30);

  const weekStart = startOfDay(week[0]!);
  const weekEnd = endOfDay(week[6]!);
  const inWeek = (e: EventRow) =>
    new Date(e.starts_at) >= weekStart && new Date(e.starts_at) <= weekEnd;

  const upcoming = events
    .filter((e) => new Date(e.starts_at) > today)
    .slice(0, 5);
  const todoDeadlines = todos
    .filter((t) => !t.is_done && t.due_date)
    .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }));
  const deadlines = [
    ...tasks
      .filter((t) => !t.is_done && t.due_date)
      .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date })),
    ...todoDeadlines,
  ]
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);

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
      <DataGate queries={[eventsQ, tasksQ, remindersQ, todosQ]}>
        <div className="grid min-w-0 gap-5 lg:grid-cols-12">
          <div className="min-w-0 space-y-5 lg:col-span-8">

            <section className="card-soft bg-accent/40 p-5">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-4" />
                <h2 className="text-sm font-semibold">Andreas lägesbild</h2>
              </div>
              <MorningSummary
                today={today}
                events={events}
                overlaps={overlaps}
                gaps={gaps}
                deadlines={deadlines}
              />
            </section>

            <section className="card-soft p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Idag</h2>
                {overlaps.length > 0 ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <AlertTriangle className="size-3.5" /> {overlaps.length} krock
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {todayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga aktiviteter idag.</p>
                ) : (
                  todayEvents.map((e) => <TodayRow key={e.id} event={e} onClick={() => open(e)} />)
                )}
              </div>
            </section>

            <section className="card-soft p-5">
              <h2 className="text-sm font-semibold">Veckans tidslinje</h2>
              <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-2">
                {week.map((day) => {
                  const load = dayLoad(events, day);
                  const items = eventsOnDay(events, day);
                  const isToday = fmt(day, "yyyy-MM-dd") === fmt(today, "yyyy-MM-dd");
                  return (
                    <Link
                      key={day.toISOString()}
                      to="/kalender"
                      search={{ vy: "dag", datum: fmt(day, "yyyy-MM-dd") }}
                      className={`flex min-w-0 flex-col items-center rounded-xl border p-1.5 transition-colors hover:border-primary/30 sm:p-3 sm:items-start ${
                        isToday ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
                      }`}
                    >
                      <span className="text-[10px] font-medium capitalize text-muted-foreground sm:text-[11px]">
                        <span className="sm:hidden">{fmt(day, "EEEEE")}</span>
                        <span className="hidden sm:inline">{fmt(day, "EEE d/M")}</span>
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground sm:hidden">
                        {fmt(day, "d")}
                      </span>
                      <div className="mt-1.5 flex items-center gap-1.5 sm:mt-2">
                        <span className={`size-2 shrink-0 rounded-full ${LOAD_STYLES[load].dot}`} />
                        <span className={`hidden text-[11px] sm:inline ${LOAD_STYLES[load].text}`}>
                          {LOAD_STYLES[load].label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap justify-center gap-0.5 sm:mt-2 sm:justify-start sm:gap-1">
                        {items.slice(0, 4).map((e) => (
                          <span
                            key={e.id}
                            className={`size-1.5 rounded-full sm:size-2 ${categoryMeta(e.category).dot}`}
                          />
                        ))}
                        {items.length > 4 ? (
                          <span className="text-[9px] text-muted-foreground">+</span>
                        ) : null}
                      </div>

                    </Link>
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
                    <Link
                      key={day.toISOString()}
                      to="/kalender"
                      search={{ vy: "dag", datum: fmt(day, "yyyy-MM-dd") }}
                      className={`aspect-square rounded-lg p-1 text-[11px] transition-colors hover:ring-1 hover:ring-primary/40 ${
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
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-5 lg:col-span-4">
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

            <PlaceCard />

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
              <h2 className="text-sm font-semibold">Kommande</h2>
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

function TodayRow({ event, onClick }: { event: EventRow; onClick: () => void }) {
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

function MorningSummary({
  today,
  events,
  overlaps,
  gaps,
  deadlines,
}: {
  today: Date;
  events: EventRow[];
  overlaps: [EventRow, EventRow][];
  gaps: { start: Date; end: Date; minutes: number }[];
  deadlines: { title: string; due_date: string | null }[];
}) {
  const items = eventsOnDay(events, today).filter((e) => !e.all_day);
  const allDay = eventsOnDay(events, today).filter((e) => e.all_day);
  const work = items.find((e) => e.category === "jobb");
  const rest = items.filter((e) => e !== work);
  const biggest = gaps.sort((a, b) => b.minutes - a.minutes)[0];

  const parts: string[] = [];
  if (items.length === 0 && allDay.length === 0) {
    parts.push("Du har inga inplanerade aktiviteter idag. Hela dagen är ledig.");
  } else {
    if (work) parts.push(`Idag arbetar du till ${fmt(work.ends_at, "HH:mm")}.`);
    if (rest.length) {
      parts.push(
        `Därefter har du ${rest.map((e) => `${e.title} klockan ${fmt(e.starts_at, "HH:mm")}`).join(" och ")}.`,
      );
    }
    if (allDay.length) {
      parts.push(`Heldag: ${allDay.map((e) => e.title).join(", ")}.`);
    }
  }

  if (biggest) {
    parts.push(
      `Största luckan är cirka ${biggest.minutes} minuter mellan ${fmt(biggest.start, "HH:mm")} och ${fmt(biggest.end, "HH:mm")}.`,
    );
  }

  if (overlaps.length) {
    const [a, b] = overlaps[0]!;
    parts.push(
      `Obs: ${a.title} krockar med ${b.title} klockan ${fmt(a.starts_at, "HH:mm")}.`,
    );
  }

  if (deadlines.length) {
    parts.push(`Du har ${deadlines.length} tidsfrist${deadlines.length > 1 ? "er" : ""} denna vecka.`);
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm leading-relaxed text-foreground">{parts.join(" ")}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <QuickLink to="/kalender" search={{ vy: "dag", datum: fmt(today, "yyyy-MM-dd") }}>
          <Calendar className="size-3.5" /> Öppna dagen
        </QuickLink>
        <QuickLink to="/jurist">
          <Clock className="size-3.5" /> {deadlines.length} deadlines
        </QuickLink>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  search,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search={(search ?? {}) as any}
      className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  );
}

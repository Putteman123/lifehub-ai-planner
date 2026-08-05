import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Plus, Sparkles, AlertTriangle, Clock, Calendar, ChevronDown } from "lucide-react";


import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { InboxCard } from "@/components/google/InboxCard";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSwipe } from "@/hooks/use-swipe";

import { categoryMeta, SHIFT_STYLES, type EventRow } from "@/lib/categories";
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
  shiftType,
  startOfDay,
  startOfMonth,
  endOfMonth,
  timeRange,
  totalHours,
  weekDays,
} from "@/lib/calendar";
import { useCaseTasks, useEvents, usePlaces, useReminders, useTodos, useVisits } from "@/lib/db";
import {
  PLACE_KINDS,
  formatDuration,
  minutesByKind,
  placeTotals,
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
    <div className="card-soft p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

/**
 * Kort som är hopfällt på mobil (minimalt scrollande) men alltid öppet från lg.
 */
function FoldCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <details className="group card-soft p-3.5 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 lg:cursor-default">
        <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {count !== undefined ? (
            <span className="rounded-full bg-surface px-2 py-0.5 tabular-nums">{count}</span>
          ) : null}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 lg:hidden" />
        </span>
      </summary>
      <div className="hidden group-open:block lg:block">{children}</div>
    </details>
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
    <section className="card-soft p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Platslogg idag</h2>
        <QuickLink to="/platser">Öppna</QuickLink>
      </div>
      <p className="mt-2 text-[15px] text-muted-foreground">
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

/** Topplista: de platser du besökt flest gånger de senaste 90 dagarna. */
function TopPlacesCard() {
  const placesQ = usePlaces();
  const now = new Date();
  const from = new Date(now.getTime() - 90 * 86400000);
  const visitsQ = useVisits(from.toISOString());
  const places = placesQ.data ?? [];
  const visits = visitsQ.data ?? [];
  const top = placeTotals(visits, places, from, now, now).slice(0, 5);

  return (
    <section className="card-soft p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Mest besökta platser</h2>
        <QuickLink to="/platser">Öppna</QuickLink>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Senaste 90 dagarna</p>
      {top.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted-foreground">Inga besök registrerade än.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {top.map((stat, i) => (
            <li key={stat.key} className="flex items-center gap-3 text-sm">
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: stat.color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{stat.name}</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {stat.visits} ggr · {formatDuration(stat.minutes)}
              </span>
            </li>
          ))}
        </ol>
      )}
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
  const [tab, setTab] = useState("idag");
  const swipeTo = (next: (t: string) => string) =>
    setTab((t) => {
      const n = next(t);
      if (n !== t) hapticTick();
      return n;
    });
  const swipe = useSwipe({
    onSwipeLeft: () =>
      swipeTo((t) => (t === "idag" ? "kalender" : t === "kalender" ? "statistik" : t)),
    onSwipeRight: () =>
      swipeTo((t) => (t === "statistik" ? "kalender" : t === "kalender" ? "idag" : t)),
  });

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

    const idagGroup = (
      <>
        {/* 1. Dagens agenda först – det viktigaste utan scroll. */}
        <section className="card-soft p-3.5 sm:p-5">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Idag</h2>
            {overlaps.length > 0 ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" /> {overlaps.length} krock
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {todayEvents.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Inga aktiviteter idag.</p>
            ) : (
              todayEvents.map((e) => <TodayRow key={e.id} event={e} onClick={() => open(e)} />)
            )}
          </div>
        </section>

        {/* 2. Andreas lägesbild – kompakt sammanfattning. */}
        <section className="card-soft bg-accent/40 p-3.5 sm:p-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <h2 className="text-[15px] font-semibold">Andreas lägesbild</h2>
          </div>
          <MorningSummary
            today={today}
            events={events}
            overlaps={overlaps}
            gaps={gaps}
            deadlines={deadlines}
          />
        </section>

        {/* 3-6. Hopfällda på mobil, öppna på dator. */}
        <FoldCard title="Ledig tid idag" count={gaps.length}>
          <ul className="mt-3 space-y-2">
            {gaps.length === 0 ? (
              <li className="text-[15px] text-muted-foreground">Ingen lucka hittad.</li>
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
        </FoldCard>

        <FoldCard title="Påminnelser" count={openReminders.length}>
          <ul className="mt-3 space-y-2">
            {openReminders.length === 0 ? (
              <li className="text-[15px] text-muted-foreground">Inga påminnelser.</li>
            ) : (
              openReminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{r.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmt(r.remind_at, "d MMM HH:mm")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </FoldCard>

        <FoldCard title="Deadlines" count={deadlines.length}>
          <ul className="mt-3 space-y-2">
            {deadlines.length === 0 ? (
              <li className="text-[15px] text-muted-foreground">Inga tidsfrister.</li>
            ) : (
              deadlines.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.due_date ? fmt(t.due_date, "d MMM") : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </FoldCard>

        <FoldCard title="Kommande" count={upcoming.length}>
          <ul className="mt-3 space-y-2">
            {upcoming.length === 0 ? (
              <li className="text-[15px] text-muted-foreground">Inget planerat framåt.</li>
            ) : (
              upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className={`size-2 shrink-0 rounded-full ${categoryMeta(e.category).dot}`} />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmt(e.starts_at, "d MMM HH:mm")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </FoldCard>
      </>
    );


    const kalenderGroup = (
      <>
            <section className="card-soft p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold">Veckans tidslinje</h2>
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
                      <span className="text-xs font-medium capitalize text-muted-foreground sm:text-xs">
                        <span className="sm:hidden">{fmt(day, "EEEEE")}</span>
                        <span className="hidden sm:inline">{fmt(day, "EEE d/M")}</span>
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                        {fmt(day, "d")}
                      </span>
                      <div className="mt-1.5 flex items-center gap-1.5 sm:mt-2">
                        <span className={`size-2 shrink-0 rounded-full ${LOAD_STYLES[load].dot}`} />
                        <span className={`hidden text-xs sm:inline ${LOAD_STYLES[load].text}`}>
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
                          <span className="text-xs text-muted-foreground">+</span>
                        ) : null}
                      </div>

                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="card-soft p-4 sm:p-5">
              <h2 className="text-[15px] font-semibold capitalize">{fmt(today, "MMMM yyyy")}</h2>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
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
                      className={`min-h-11 rounded-lg p-1.5 text-[13px] font-medium transition-colors hover:ring-1 hover:ring-primary/40 ${
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
      </>
    );

    const statistikGroup = (
      <>
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

            <InboxCard />
            <PlaceCard />
            <TopPlacesCard />

            <ShiftSummaryCard events={events} />
      </>
    );

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
        {/* Mobil: flikar så varje vy får full bredd och läsbar text. */}
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 lg:hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="idag" className="min-h-11 text-[13px]">
              Idag
            </TabsTrigger>
            <TabsTrigger value="kalender" className="min-h-11 text-[13px]">
              Kalender
            </TabsTrigger>
            <TabsTrigger value="statistik" className="min-h-11 text-[13px]">
              Statistik
            </TabsTrigger>
          </TabsList>
          {/* Svep i sidled för att byta flik på mobil. */}
          <div className="min-w-0 touch-pan-y" {...swipe}>
            <TabsContent key={tab} value="idag" className="view-enter mt-4 space-y-4">
              {idagGroup}
            </TabsContent>
            <TabsContent key={`${tab}-k`} value="kalender" className="view-enter mt-4 space-y-4">
              {kalenderGroup}
            </TabsContent>
            <TabsContent key={`${tab}-s`} value="statistik" className="view-enter mt-4 space-y-4">
              {statistikGroup}
            </TabsContent>
          </div>
        </Tabs>


        {/* Dator: allt i två kolumner som tidigare. */}
        <div className="hidden min-w-0 gap-5 lg:grid lg:grid-cols-12">
          <div className="min-w-0 space-y-5 lg:col-span-8">
            <>
              {idagGroup}
            </>
          </div>
          <div className="min-w-0 space-y-5 lg:col-span-4">
            <>
              {kalenderGroup}
              {statistikGroup}
            </>
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
      className={`grid w-full min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-xl border-l-2 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-accent sm:flex sm:items-center ${meta.bar}`}
    >
      <span className="order-2 col-span-2 text-[13px] tabular-nums text-muted-foreground sm:order-none sm:col-span-1 sm:w-24 sm:shrink-0">
        {timeRange(event)}
      </span>
      <span className="order-1 min-w-0 truncate text-[15px] font-medium sm:order-none sm:flex-1">
        {event.title}
      </span>
      <span
        className={`order-1 shrink-0 self-start rounded-full px-2 py-0.5 text-xs sm:order-none sm:self-auto ${meta.chip}`}
      >
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
      <p className="text-[15px] leading-relaxed text-foreground">{parts.join(" ")}</p>
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

/** Sammanställning av natt- och kvällspass på schemat. */
function ShiftSummaryCard({ events }: { events: EventRow[] }) {
  const now = new Date();
  const stats = useMemo(() => {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const count = (from: Date, to: Date, type: "natt" | "kvall") =>
      events.filter((e) => {
        const s = new Date(e.starts_at);
        return s >= from && s <= to && shiftType(e) === type;
      }).length;
    const future = new Date(now.getTime() + 365 * 86400000);
    return {
      monthNatt: count(monthStart, monthEnd, "natt"),
      monthKvall: count(monthStart, monthEnd, "kvall"),
      comingNatt: count(now, future, "natt"),
      comingKvall: count(now, future, "kvall"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const rows = [
    {
      label: "Nattpass",
      dot: SHIFT_STYLES.natt.dot,
      month: stats.monthNatt,
      coming: stats.comingNatt,
    },
    {
      label: "Kvällspass",
      dot: SHIFT_STYLES.kvall.dot,
      month: stats.monthKvall,
      coming: stats.comingKvall,
    },
  ];

  return (
    <section className="card-soft p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Pass på schemat</h2>
        <QuickLink to="/kalender">Kalender</QuickLink>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 text-sm">
        <span />
        <span className="text-xs text-muted-foreground">{fmt(now, "MMM")}</span>
        <span className="text-xs text-muted-foreground">Kommande</span>
        {rows.map((r) => (
          <Fragment key={r.label}>
            <span className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${r.dot}`} />
              {r.label}
            </span>
            <span className="text-right tabular-nums font-semibold">{r.month}</span>
            <span className="text-right tabular-nums font-semibold">{r.coming}</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

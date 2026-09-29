import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Baby, Briefcase, CalendarDays, Car, ChevronLeft, ChevronRight, Dumbbell, Plus, Scale, Star, Users } from "lucide-react";
import { DayBriefCard } from "@/components/calendar/DayBriefCard";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftLegend } from "@/components/calendar/ShiftLegend";
import { MeetingSlotsCard } from "@/components/calendar/MeetingSlotsCard";
import { SHIFT_STYLES, type Category, type EventRow } from "@/lib/categories";
import { useCategoryOptions } from "@/lib/event-categories";
import {
  addDays,
  dayLoad,
  eventsOnDay,
  fmt,
  LOAD_STYLES,
  mergeDuplicates,
  monthGrid,
  overlapsOnDay,
  shiftMeta,
  shiftType,
  timeRange,
  weekDays,
} from "@/lib/calendar";
import { useEvents } from "@/lib/db";
import { isTripEvent, useTripEvents } from "@/lib/trip-events";
import { PiggyMarker } from "@/components/pengar/PiggyMarker";
import { useDailyResult } from "@/lib/finance";


type View = "dag" | "vecka" | "manad" | "ar" | "agenda";

const VIEWS: View[] = ["dag", "vecka", "manad", "ar", "agenda"];

export const Route = createFileRoute("/_authenticated/kalender")({
  validateSearch: (search: Record<string, unknown>) => ({
    vy: VIEWS.includes(search['vy'] as View) ? (search['vy'] as View) : undefined,
    datum: typeof search['datum'] === "string" ? (search['datum'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Kalender – LifeHub AI" },
      { name: "description", content: "Dag, vecka, månad, år och agenda – alla kalendrar i en vy." },
      { property: "og:title", content: "Kalender – LifeHub AI" },
      { property: "og:description", content: "Alla dina aktiviteter i en färgkodad kalender." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/kalender" });
  const eventsQ = useEvents();
  const rawEvents = eventsQ.data ?? [];
  const tripsQ = useTripEvents();
  const [view, setView] = useState<View>(search.vy ?? "vecka");
  const [cursor, setCursor] = useState(() =>
    search.datum ? new Date(`${search.datum}T12:00:00`) : new Date(),
  );
  const { options: categoryOptions } = useCategoryOptions();
  const piggy = useDailyResult();
  const [hidden, setHidden] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);

  const events = useMemo(
    () =>
      mergeDuplicates([...rawEvents, ...(tripsQ.data ?? [])]).filter(
        (e) => !hidden.includes(e.category),
      ),
    [rawEvents, tripsQ.data, hidden],
  );




  useEffect(() => {
    const dateStr = fmt(cursor, "yyyy-MM-dd");
    const isToday = dateStr === fmt(new Date(), "yyyy-MM-dd");
    void navigate({
      search: {
        vy: view === "vecka" ? undefined : view,
        datum: isToday ? undefined : dateStr,
      },
      replace: true,
    });
  }, [view, cursor, navigate]);

  function openDay(date: Date) {
    setCursor(date);
    setView("dag");
  }

  function shift(direction: number) {
    const next = new Date(cursor);
    if (view === "dag") next.setDate(next.getDate() + direction);
    else if (view === "vecka") next.setDate(next.getDate() + 7 * direction);
    else if (view === "manad" || view === "agenda") next.setMonth(next.getMonth() + direction);
    else next.setFullYear(next.getFullYear() + direction);
    setCursor(next);
  }

  function open(event: EventRow | null, date?: Date) {
    if (event && isTripEvent(event)) {
      void navigate({ to: "/platser" });
      return;
    }
    setSelected(event);
    if (date) setCursor(date);
    setDialogOpen(true);
  }


  function toggle(category: Category) {
    setHidden((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  const label =
    view === "dag"
      ? fmt(cursor, "EEEE d MMMM yyyy")
      : view === "vecka"
        ? `Vecka ${fmt(cursor, "w")} · ${fmt(cursor, "MMMM yyyy")}`
        : view === "ar"
          ? fmt(cursor, "yyyy")
          : fmt(cursor, "MMMM yyyy");

  return (
    <AppShell
      title="Kalender"
      subtitle={label}
      actions={
        <Button size="sm" onClick={() => open(null, cursor)}>
          <Plus className="size-4" /> Ny
        </Button>
      }
    >
      <DataGate queries={[eventsQ]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="dag">Dag</TabsTrigger>
            <TabsTrigger value="vecka">Vecka</TabsTrigger>
            <TabsTrigger value="manad">Månad</TabsTrigger>
            <TabsTrigger value="ar">År</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Idag
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categoryOptions.map((c) => (
          <button
            key={c.value}
            onClick={() => toggle(c.value)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              !hidden.includes(c.value)
                ? `${c.chip} border-transparent`
                : "border-border text-muted-foreground"
            }`}
          >
            <span className={`size-2 rounded-full ${c.dot}`} />
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ShiftLegend showLoad={view === "ar"} />
      </div>

      <div className="mt-5">
        {view === "dag" ? (
          <DayView events={events} day={cursor} onSelect={open} piggy={piggy} />
        ) : null}
        {view === "vecka" ? (
          <WeekView events={events} day={cursor} onSelect={open} onOpenDay={openDay} piggy={piggy} />
        ) : null}
        {view === "manad" ? (
          <MonthView events={events} day={cursor} onSelect={open} onOpenDay={openDay} piggy={piggy} />
        ) : null}
        {view === "ar" ? <YearView events={events} day={cursor} onPick={openDay} /> : null}
        {view === "agenda" ? <AgendaView events={events} day={cursor} onSelect={open} piggy={piggy} /> : null}

      </div>

      <div className="mt-5">
        <MeetingSlotsCard events={events} />
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selected}
        defaultDate={cursor}
      />
      </DataGate>
    </AppShell>
  );
}

type SelectFn = (event: EventRow | null, date?: Date) => void;
type PiggyFn = ((date: Date | string) => number | null) | null;

function OverlapWarning({ events, day }: { events: EventRow[]; day: Date }) {
  const pairs = overlapsOnDay(events, day);
  if (pairs.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive">
      <span className="size-1.5 rounded-full bg-destructive" />
      {pairs.length === 1 ? "Krock i schemat" : `${pairs.length} krockar`}
    </div>
  );
}

function eventIcon(e: EventRow) {
  const t = `${e.title} ${e.category}`.toLowerCase();
  if (shiftType(e)) return Briefcase;
  if (/möte|meet|samtal|zoom|teams/.test(t)) return Users;
  if (/resa|flyg|tåg|bil|kör/.test(t)) return Car;
  if (/barn|skola|förskola/.test(t)) return Baby;
  if (/jurist|ärende|advokat/.test(t)) return Scale;
  if (/viktig/.test(t)) return Star;
  if (/träning|gym|löp/.test(t)) return Dumbbell;
  return CalendarDays;
}

function EventChip({ event, onSelect }: { event: EventRow; onSelect: SelectFn }) {
  const meta = shiftMeta(event);
  const Icon = eventIcon(event);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium shadow-sm transition hover:brightness-95 ${meta.chip}`}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" />
      <span className="min-w-0 truncate">
        {event.all_day ? "" : <span className="tabular-nums opacity-75">{fmt(event.starts_at, "HH:mm")} </span>}
        {event.title}
      </span>
    </button>
  );
}

const HOUR_PX = 64;

function layoutDay(items: EventRow[], day: Date) {
  const start0 = new Date(day);
  start0.setHours(0, 0, 0, 0);
  const rows = items
    .map((e) => {
      const s = Math.max(0, (new Date(e.starts_at).getTime() - start0.getTime()) / 60000);
      const en = Math.min(1440, (new Date(e.ends_at).getTime() - start0.getTime()) / 60000);
      return { e, s, en: Math.max(en, s + 30) };
    })
    .sort((a, b) => a.s - b.s);
  const out: { e: EventRow; s: number; en: number; col: number; cols: number }[] = [];
  let group: typeof out = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => (g.cols = cols));
    out.push(...group);
    group = [];
  };
  for (const r of rows) {
    if (r.s >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.en > r.s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ...r, col, cols: 1 });
    groupEnd = Math.max(groupEnd, r.en);
  }
  if (group.length) flush();
  return out;
}

function DayView({
  events,
  day,
  onSelect,
  piggy,
}: {
  events: EventRow[];
  day: Date;
  onSelect: SelectFn;
  piggy?: PiggyFn;
}) {
  const items = eventsOnDay(events, day);
  const allDay = items.filter((e) => e.all_day);
  const timed = layoutDay(items.filter((e) => !e.all_day), day);
  const load = dayLoad(events, day);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const isToday = fmt(day, "yyyy-MM-dd") === fmt(now, "yyyy-MM-dd");
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const target = isToday ? nowMin - 90 : timed[0] ? timed[0].s - 60 : 7 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, (target / 60) * HOUR_PX) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  return (
    <div>
      <DayBriefCard events={events} day={day} />
      <div className="card-soft p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className={`flex items-center gap-2 text-sm ${LOAD_STYLES[load].text}`}>
            <span className={`size-2 rounded-full ${LOAD_STYLES[load].dot}`} />
            {LOAD_STYLES[load].label} · {items.length} {items.length === 1 ? "aktivitet" : "aktiviteter"}
          </div>
          <PiggyMarker amount={piggy?.(day) ?? null} size="md" />
        </div>
        {allDay.length ? (
          <div className="mb-3 space-y-1.5">
            {allDay.map((e) => (
              <EventChip key={e.id} event={e} onSelect={onSelect} />
            ))}
          </div>
        ) : null}
        <OverlapWarning events={events} day={day} />
        <div ref={scrollRef} className="relative mt-2 max-h-[65vh] overflow-y-auto rounded-xl border border-border/60">
          <div className="relative" style={{ height: 24 * HOUR_PX }}>
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                onClick={() => {
                  const d = new Date(day);
                  d.setHours(h, 0, 0, 0);
                  onSelect(null, d);
                }}
                className="absolute inset-x-0 flex border-t border-border/50 text-left hover:bg-accent/40"
                style={{ top: h * HOUR_PX, height: HOUR_PX }}
                aria-label={`Ny händelse ${h}:00`}
              >
                <span className="w-12 shrink-0 -translate-y-2 bg-card pl-2 text-[11px] tabular-nums text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </span>
              </button>
            ))}
            {timed.map(({ e, s, en, col, cols }) => {
              const meta = shiftMeta(e);
              const Icon = eventIcon(e);
              const h = ((en - s) / 60) * HOUR_PX;
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className={`absolute overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left shadow-sm transition hover:shadow-md ${meta.chip} ${meta.bar}`}
                  style={{
                    top: (s / 60) * HOUR_PX + 1,
                    height: h - 2,
                    left: `calc(3.25rem + (100% - 3.75rem) * ${col / cols})`,
                    width: `calc((100% - 3.75rem) / ${cols} - 4px)`,
                  }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{e.title}</span>
                  </span>
                  {h > 36 ? (
                    <span className="block truncate text-[11px] tabular-nums opacity-80">
                      {timeRange(e)}
                      {e.location ? ` · ${e.location}` : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {isToday ? (
              <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin / 60) * HOUR_PX }}>
                <span className="ml-11 size-2.5 rounded-full bg-destructive" />
                <span className="h-0.5 flex-1 bg-destructive" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({
  events,
  day,
  onSelect,
  onOpenDay,
  piggy,
}: {
  events: EventRow[];
  day: Date;
  onSelect: SelectFn;
  onOpenDay: (date: Date) => void;
  piggy?: PiggyFn;
}) {
  const days = weekDays(day);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const items = eventsOnDay(events, d);
        const load = dayLoad(events, d);
        return (
          <div
            key={d.toISOString()}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDay(d)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpenDay(d);
            }}
            className="card-soft min-h-32 cursor-pointer p-3 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium capitalize">
                {fmt(d, "EEE d/M")}
                <PiggyMarker amount={piggy?.(d) ?? null} />
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${LOAD_STYLES[load].dot}`} />
                <button
                  aria-label="Ny händelse"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(null, d);
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {items.map((e) => (
                <EventChip key={e.id} event={e} onSelect={onSelect} />
              ))}
              <OverlapWarning events={events} day={d} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  events,
  day,
  onSelect,
  onOpenDay,
  piggy,
}: {
  events: EventRow[];
  day: Date;
  onSelect: SelectFn;
  onOpenDay: (date: Date) => void;
  piggy?: PiggyFn;
}) {
  const days = monthGrid(day);
  return (
    <div className="card-soft p-3">
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] text-muted-foreground">
        {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const items = eventsOnDay(events, d);
          const otherMonth = d.getMonth() !== day.getMonth();
          return (
            <div
              key={d.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onOpenDay(d);
              }}
              className={`min-h-20 cursor-pointer rounded-lg bg-surface p-1.5 text-left align-top hover:bg-accent ${
                otherMonth ? "opacity-45" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium">{fmt(d, "d")}</span>
                {otherMonth ? null : <PiggyMarker amount={piggy?.(d) ?? null} />}
              </span>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} onSelect={onSelect} />
                ))}
                {items.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{items.length - 3} till
                  </span>
                ) : null}
                <OverlapWarning events={events} day={d} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function YearView({
  events,
  day,
  onPick,
}: {
  events: EventRow[];
  day: Date;
  onPick: (date: Date) => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(day.getFullYear(), i, 1));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {months.map((m) => {
        const days = monthGrid(m);
        return (
          <div key={m.toISOString()} className="card-soft p-3 text-left">
            <button
              onClick={() => onPick(m)}
              className="text-xs font-semibold capitalize hover:text-primary"
            >
              {fmt(m, "MMMM")}
            </button>
            <div className="mt-2 grid grid-cols-7 gap-0.5">
              {days.map((d) => {
                const load = dayLoad(events, d);
                const other = d.getMonth() !== m.getMonth();
                const dayEvents = eventsOnDay(events, d);
                const hasNatt = dayEvents.some((e) => shiftType(e) === "natt");
                const hasKvall = dayEvents.some((e) => shiftType(e) === "kvall");
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => onPick(d)}
                    className={`relative flex aspect-square items-center justify-center rounded-[3px] text-[9px] transition-colors hover:ring-1 hover:ring-primary/50 ${
                      other ? "opacity-30" : ""
                    } ${
                      load === "full"
                        ? "bg-cat-viktigt/20"
                        : load === "delvis"
                          ? "bg-cat-barn/20"
                          : "bg-surface"
                    }`}
                  >
                    {fmt(d, "d")}
                    {hasNatt || hasKvall ? (
                      <span className="absolute bottom-0.5 flex gap-0.5">
                        {hasNatt ? (
                          <span className={`size-1 rounded-full ${SHIFT_STYLES.natt.dot}`} />
                        ) : null}
                        {hasKvall ? (
                          <span className={`size-1 rounded-full ${SHIFT_STYLES.kvall.dot}`} />
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

          </div>
        );
      })}

    </div>
  );
}

function AgendaView({
  events,
  day,
  onSelect,
  piggy,
}: {
  events: EventRow[];
  day: Date;
  onSelect: SelectFn;
  piggy?: PiggyFn;
}) {
  const days = Array.from({ length: 30 }, (_, i) => addDays(day, i));
  const withEvents = days
    .map((d) => ({ day: d, items: eventsOnDay(events, d) }))
    .filter((d) => d.items.length > 0);

  if (withEvents.length === 0) {
    return (
      <div className="card-soft p-6 text-sm text-muted-foreground">
        Inga aktiviteter de kommande 30 dagarna.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withEvents.map(({ day: d, items }) => (
        <section key={d.toISOString()} className="card-soft p-4">
          <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {fmt(d, "EEEE d MMMM")}
            <PiggyMarker amount={piggy?.(d) ?? null} />
          </h3>
          <div className="mt-3 space-y-2">
            {items.map((e) => {
              const meta = shiftMeta(e);
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-2 bg-surface px-3 py-2 text-left hover:bg-accent ${meta.bar}`}
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {timeRange(e)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                  {meta.shift ? (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                      {meta.label}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <OverlapWarning events={events} day={d} />
          </div>
        </section>
      ))}
    </div>
  );
}

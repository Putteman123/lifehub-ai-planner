import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftLegend } from "@/components/calendar/ShiftLegend";
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
    () => mergeDuplicates(rawEvents).filter((e) => !hidden.includes(e.category)),
    [rawEvents, hidden],
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

function EventChip({ event, onSelect }: { event: EventRow; onSelect: SelectFn }) {
  const meta = shiftMeta(event);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
      className={`w-full truncate rounded-md px-2 py-1 text-left text-[11px] ${meta.chip}`}
    >
      {event.all_day ? "" : `${fmt(event.starts_at, "HH:mm")} `}
      {event.title}
    </button>
  );
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
  const load = dayLoad(events, day);
  return (
    <div className="card-soft p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-sm ${LOAD_STYLES[load].text}`}>
          <span className={`size-2 rounded-full ${LOAD_STYLES[load].dot}`} />
          {LOAD_STYLES[load].label}
        </div>
        <PiggyMarker amount={piggy?.(day) ?? null} size="md" />
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga aktiviteter denna dag.</p>
        ) : (
          items.map((e) => {
            const meta = shiftMeta(e);
            return (
              <button
                key={e.id}
                onClick={() => onSelect(e)}
                className={`flex w-full items-center gap-3 rounded-lg border-l-2 bg-surface px-3 py-3 text-left hover:bg-accent ${meta.bar}`}
              >
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {timeRange(e)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{e.title}</span>
                    {meta.shift ? (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                        {meta.label}
                      </span>
                    ) : null}
                  </span>
                  {e.location ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.location}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
        <OverlapWarning events={events} day={day} />
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

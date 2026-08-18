import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Merge,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditTripDialog } from "@/components/platser/EditTripDialog";
import { EditVisitDialog } from "@/components/platser/EditVisitDialog";
import { MapDialog, type MapTarget } from "@/components/platser/MapDialog";
import { NameVisitDialog, type NameVisitTarget } from "@/components/platser/NameVisitDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteRow, useEvents, useVisits } from "@/lib/db";
import {
  buildDayEntries,
  dayTitle,
  isNoise,
  shiftDay,
  shortDayTime,
  startOfDayKey,
  type DayEntry,
} from "@/lib/day-log";
import {
  PLACE_KINDS,
  formatDistance,
  formatDuration,
  timeLabel,
  travelModeLabel,
  visitLabel,
  type PlaceKind,
  type PlaceRow,
  type VisitRow,
} from "@/lib/geo";
import { markVisitTravel, mergeVisits, nameVisit } from "@/lib/places.functions";

function timeOnly(date: Date) {
  return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

/** Dagens reselogg – en dag i taget, städad och fullt redigerbar. */
export function DayLogCard({ places }: { places: PlaceRow[] }) {
  const qc = useQueryClient();
  const [day, setDay] = useState(() => startOfDayKey(new Date()));
  const [showNoise, setShowNoise] = useState(false);
  const [editVisit, setEditVisit] = useState<VisitRow | null>(null);
  const [editTrip, setEditTrip] = useState<VisitRow | null>(null);
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);
  const [nameTarget, setNameTarget] = useState<NameVisitTarget | null>(null);
  const [namingBusy, setNamingBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const since = useMemo(() => new Date(Date.now() - 45 * 86400000).toISOString(), []);
  const visitsQ = useVisits(since);
  const eventsQ = useEvents();
  const deleteVisit = useDeleteRow("visits", "Posten borttagen");

  const saveName = useServerFn(nameVisit);
  const markTravel = useServerFn(markVisitTravel);
  const merge = useServerFn(mergeVisits);

  const now = new Date();
  const visits = visitsQ.data ?? [];
  const allEntries = useMemo(
    () => buildDayEntries(visits, day, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits, day],
  );
  const noiseCount = allEntries.filter(isNoise).length;
  const entries = showNoise ? allEntries : allEntries.filter((e) => !isNoise(e));

  const stops = entries.filter((e) => !e.travel);
  const trips = entries.filter((e) => e.travel);
  const meters = trips.reduce((sum, e) => sum + e.meters, 0);
  const minutes = stops.reduce((sum, e) => sum + e.minutes, 0);

  const dayEvents = useMemo(() => {
    const [y, m, d] = day.split("-").map(Number);
    const start = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
    const end = new Date(start.getTime() + 86400000);
    return (eventsQ.data ?? []).filter((e) => {
      const at = new Date(e.starts_at);
      return at >= start && at < end;
    });
  }, [eventsQ.data, day]);

  const noteSuggestions = Array.from(
    new Set(visits.map((v) => v.note?.trim()).filter((n): n is string => Boolean(n))),
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["visits"] });
  }

  async function handleName(values: {
    visitId: string;
    label: string;
    note: string;
    kind: PlaceKind;
    saveAsPlace: boolean;
  }) {
    setNamingBusy(true);
    try {
      const res = await saveName({ data: values });
      await refresh();
      await qc.invalidateQueries({ queryKey: ["places"] });
      toast.success(
        res.linked > 1 ? `Sparat · ${res.linked} besök kopplade` : "Platsen är namngiven",
      );
      setNameTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara platsen.");
    } finally {
      setNamingBusy(false);
    }
  }

  async function handleMarkTravel(visitId: string) {
    setBusyId(visitId);
    try {
      const res = await markTravel({ data: { visitId } });
      await refresh();
      toast.success(`Markerad som resa · ${formatDistance(res.distance_m)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte markera som resa.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMerge(entry: DayEntry, previous: DayEntry) {
    const ids = [
      previous.visit.id,
      ...previous.merged.map((v) => v.id),
      entry.visit.id,
      ...entry.merged.map((v) => v.id),
    ];
    setBusyId(entry.visit.id);
    try {
      await merge({ data: { visitIds: ids } });
      await refresh();
      toast.success("Posterna är sammanslagna");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte slå ihop posterna.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: DayEntry) {
    if (!confirm("Ta bort posten ur loggen?")) return;
    for (const v of [entry.visit, ...entry.merged]) {
      await deleteVisit.mutateAsync(v.id);
    }
  }

  function openEntry(entry: DayEntry) {
    if (entry.travel) setEditTrip(entry.visit);
    else setEditVisit(entry.visit);
  }

  const isToday = day === startOfDayKey(new Date());

  return (
    <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Reselogg</h2>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Föregående dag"
            onClick={() => setDay((d) => shiftDay(d, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={day}
            className="h-9 w-[150px]"
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Nästa dag"
            disabled={isToday}
            onClick={() => setDay((d) => shiftDay(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium capitalize">{dayTitle(day, now)}</span>
        <span className="text-xs text-muted-foreground">
          {stops.length} platser · {trips.length} resor · {formatDistance(meters)} ·{" "}
          {formatDuration(minutes)} på plats
        </span>
      </div>

      {visitsQ.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Hämtar dagen…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Inget registrerat den här dagen.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((entry, index) => {
            const visit = entry.visit;
            const place = places.find((p) => p.id === visit.place_id);
            const color =
              place?.color ?? PLACE_KINDS.find((k) => k.value === "annat")?.color ?? "#64748b";
            const previous = index > 0 ? entries[index - 1] : undefined;
            const canMerge =
              previous &&
              !entry.travel &&
              !previous.travel &&
              (previous.visit.place_id
                ? previous.visit.place_id === visit.place_id
                : !visit.place_id);
            const span = `${timeOnly(entry.from)}–${
              entry.open || entry.continues ? "nu" : timeOnly(entry.to)
            }`;
            return (
              <li
                key={visit.id}
                className={`group rounded-xl border px-3 py-2 ${
                  entry.travel ? "border-dashed border-border/60 bg-muted/30" : "border-border/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => openEntry(entry)}
                  >
                    <span className="w-[92px] shrink-0 text-xs tabular-nums text-muted-foreground">
                      {span}
                    </span>
                    {entry.travel ? (
                      <Car className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.travel ? "Resa" : visitLabel(visit, places)}
                      {visit.note ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {visit.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.travel
                        ? `${formatDistance(entry.meters)} · ${formatDuration(entry.minutes)}`
                        : formatDuration(entry.minutes)}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {!entry.travel && !place ? (
                      <button
                        type="button"
                        aria-label="Namnge plats"
                        className="text-primary"
                        onClick={() =>
                          setNameTarget({
                            visitId: visit.id,
                            subtitle: `${span} · ${formatDuration(entry.minutes)}`,
                            lat: visit.lat,
                            lng: visit.lng,
                            label: visit.label,
                            note: visit.note,
                          })
                        }
                      >
                        <Tag className="size-3.5" />
                      </button>
                    ) : null}
                    {visit.lat != null && visit.lng != null ? (
                      <button
                        type="button"
                        aria-label="Visa på karta"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setMapTarget({
                            title: entry.travel ? "Resa" : visitLabel(visit, places),
                            subtitle: `${span} · ${formatDuration(entry.minutes)}`,
                            lat: (entry.travel ? (visit.end_lat ?? visit.lat) : visit.lat)!,
                            lng: (entry.travel ? (visit.end_lng ?? visit.lng) : visit.lng)!,
                          })
                        }
                      >
                        <MapPin className="size-3.5" />
                      </button>
                    ) : null}
                    {canMerge && previous ? (
                      <button
                        type="button"
                        aria-label="Slå ihop med föregående"
                        className="text-muted-foreground hover:text-foreground"
                        disabled={busyId === visit.id}
                        onClick={() => void handleMerge(entry, previous)}
                      >
                        {busyId === visit.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Merge className="size-3.5" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Redigera"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => openEntry(entry)}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ta bort"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDelete(entry)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[104px] text-[11px] text-muted-foreground">
                  {entry.startsEarlier ? (
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      sedan {shortDayTime(new Date(visit.arrived_at))}
                    </span>
                  ) : null}
                  {entry.open ? (
                    <span className="rounded-full bg-cat-ledig/15 px-2 py-0.5 font-medium text-cat-ledig">
                      pågår
                    </span>
                  ) : null}
                  {entry.merged.length > 0 ? (
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      {entry.merged.length + 1} poster i följd
                    </span>
                  ) : null}
                  {entry.travel ? (
                    <span className="rounded-full bg-surface px-2 py-0.5">
                      {travelModeLabel(visit.travel_mode)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-border/70 px-2 py-0.5 hover:border-primary hover:text-primary"
                      disabled={busyId === visit.id}
                      onClick={() => void handleMarkTravel(visit.id)}
                    >
                      Markera som resa
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {noiseCount > 0 ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowNoise((v) => !v)}
        >
          {showNoise ? "Dölj småposter" : `Visa ${noiseCount} småposter`}
        </button>
      ) : null}

      {dayEvents.length > 0 && entries.length > 0 ? (
        <div className="mt-5 border-t border-border/70 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mot kalendern
          </h3>
          <ul className="mt-2 space-y-1.5">
            {dayEvents.map((event) => {
              const start = new Date(event.starts_at);
              const at = allEntries.find((e) => e.from <= start && e.to >= start);
              return (
                <li key={event.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {timeLabel(event.starts_at)} {event.title}
                  </span>{" "}
                  –{" "}
                  {at
                    ? `du var på ${at.travel ? "resande fot" : visitLabel(at.visit, places)}`
                    : "ingen plats registrerad"}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <EditVisitDialog visit={editVisit} places={places} onClose={() => setEditVisit(null)} />
      <EditTripDialog trip={editTrip} places={places} onClose={() => setEditTrip(null)} />
      <MapDialog target={mapTarget} onOpenChange={(open) => !open && setMapTarget(null)} />
      <NameVisitDialog
        target={nameTarget}
        suggestions={noteSuggestions}
        saving={namingBusy}
        onOpenChange={(open) => !open && setNameTarget(null)}
        onSave={handleName}
      />
    </section>
  );
}

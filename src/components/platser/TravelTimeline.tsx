import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Car, ExternalLink, Loader2, Merge, Pencil, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EditTripDialog } from "@/components/platser/EditTripDialog";
import { MODE_ICONS } from "@/components/platser/TravelModeStats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useVisits } from "@/lib/db";
import {
  formatDistance,
  formatDuration,
  isTravel,
  timeLabel,
  travelModeLabel,
  visitMinutes,
  type PlaceRow,
  type VisitRow,
} from "@/lib/geo";
import { mergeVisitTravels } from "@/lib/places.functions";



const DAYS = 90;

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Kartutsnitt som rymmer både start och slut. */
function bboxFor(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const padLat = Math.max(0.004, (Math.max(...lats) - Math.min(...lats)) * 0.35);
  const padLng = Math.max(0.006, (Math.max(...lngs) - Math.min(...lngs)) * 0.35);
  return [
    Math.min(...lngs) - padLng,
    Math.min(...lats) - padLat,
    Math.max(...lngs) + padLng,
    Math.max(...lats) + padLat,
  ]
    .map((v) => v.toFixed(5))
    .join("%2C");
}

type Trip = {
  visit: VisitRow;
  start: { lat: number; lng: number } | null;
  end: { lat: number; lng: number } | null;
};

function endpointName(
  point: { lat: number; lng: number } | null,
  places: PlaceRow[],
  fallback: string,
) {
  if (!point) return fallback;
  let best: { name: string; distance: number } | null = null;
  for (const place of places) {
    const dLat = (place.lat - point.lat) * 111320;
    const dLng = (place.lng - point.lng) * 111320 * Math.cos((point.lat * Math.PI) / 180);
    const distance = Math.hypot(dLat, dLng);
    if (distance <= Math.max(place.radius_m, 200) && (!best || distance < best.distance)) {
      best = { name: place.name, distance };
    }
  }
  return best?.name ?? fallback;
}

/** Karta med tidslinje över alla registrerade resor. */
export function TravelTimeline({ places }: { places: PlaceRow[] }) {
  const sinceIso = useMemo(
    () => new Date(Date.now() - DAYS * 86400000).toISOString(),
    [],
  );
  const visitsQ = useVisits(sinceIso);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<VisitRow | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const qc = useQueryClient();
  const mergeTravels = useServerFn(mergeVisitTravels);



  const trips = useMemo<Trip[]>(() => {
    const rows = (visitsQ.data ?? []).filter(isTravel);
    return rows
      .map((visit) => ({
        visit,
        start: visit.lat != null && visit.lng != null ? { lat: visit.lat, lng: visit.lng } : null,
        end:
          visit.end_lat != null && visit.end_lng != null
            ? { lat: visit.end_lat, lng: visit.end_lng }
            : null,
      }))
      .sort((a, b) => b.visit.arrived_at.localeCompare(a.visit.arrived_at));
  }, [visitsQ.data]);

  const selected = trips.find((t) => t.visit.id === selectedId) ?? trips[0] ?? null;

  const grouped = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const trip of trips) {
      const key = dayKey(trip.visit.arrived_at);
      map.set(key, [...(map.get(key) ?? []), trip]);
    }
    return [...map.entries()];
  }, [trips]);

  const totalMeters = trips.reduce((sum, t) => sum + (t.visit.distance_m ?? 0), 0);

  const points = selected ? [selected.start, selected.end].filter(Boolean) : [];
  const hasMap = points.length > 0;

  // Sammanfattning av de markerade resorna, sorterade i tidsordning.
  const pickedTrips = useMemo(() => {
    return trips
      .filter((t) => picked.includes(t.visit.id))
      .sort((a, b) => a.visit.arrived_at.localeCompare(b.visit.arrived_at));
  }, [trips, picked]);

  const pickedSummary = useMemo(() => {
    if (pickedTrips.length < 2) return null;
    const first = pickedTrips[0]!.visit;
    const last = pickedTrips[pickedTrips.length - 1]!.visit;
    const meters = pickedTrips.reduce((sum, t) => sum + (t.visit.distance_m ?? 0), 0);
    const minutes = Math.max(
      0,
      Math.round(
        (new Date(last.left_at ?? last.arrived_at).getTime() -
          new Date(first.arrived_at).getTime()) /
          60000,
      ),
    );
    return { first, last, meters, minutes, count: pickedTrips.length };
  }, [pickedTrips]);

  function togglePick(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function exitMergeMode() {
    setMergeMode(false);
    setPicked([]);
  }

  async function runMerge() {
    if (!pickedSummary) return;
    setMerging(true);
    try {
      const res = await mergeTravels({ data: { visitIds: pickedTrips.map((t) => t.visit.id) } });
      await qc.invalidateQueries({ queryKey: ["visits"] });
      toast.success(
        `Sammanslagen resa: ${formatDistance(res.distance_m)} · ${formatDuration(res.minutes)}`,
      );
      setConfirmOpen(false);
      exitMergeMode();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte slå ihop resorna.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Car className="size-4" /> Reskarta &amp; tidslinje
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {trips.length} resor · {formatDistance(totalMeters)} senaste {DAYS} dagarna
          </span>
          {trips.length >= 2 ? (
            mergeMode ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!pickedSummary}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Merge className="size-3.5" />
                  Slå ihop {picked.length > 0 ? `${picked.length} ` : ""}resor
                </button>
                <button
                  type="button"
                  onClick={exitMergeMode}
                  aria-label="Avbryt sammanslagning"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMergeMode(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Merge className="size-3.5" /> Slå ihop
              </button>
            )
          ) : null}
        </div>
      </div>


      {trips.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga resor registrerade än. Resor loggas automatiskt när du förflyttar dig.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            {hasMap && selected ? (
              <>
                <div className="overflow-hidden rounded-xl border border-border">
                  <iframe
                    title="Karta över vald resa"
                    className="h-56 w-full border-0 md:h-64"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${bboxFor(
                      points as { lat: number; lng: number }[],
                    )}&layer=mapnik&marker=${(selected.end ?? selected.start)!.lat}%2C${
                      (selected.end ?? selected.start)!.lng
                    }`}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {endpointName(selected.start, places, "Startpunkt")} →{" "}
                    {endpointName(selected.end, places, "Slutpunkt")}
                  </p>
                  {selected.start && selected.end ? (
                    <a
                      href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${selected.start.lat}%2C${selected.start.lng}%3B${selected.end.lat}%2C${selected.end.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      <ExternalLink className="size-3.5" /> Visa rutt
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Ingen position registrerad för den här resan.
              </p>
            )}
          </div>

          <ol className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
            {grouped.map(([day, dayTrips]) => (
              <li key={day}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {day}
                </p>
                <ul className="mt-2 space-y-1.5 border-l border-border/70 pl-3">
                  {dayTrips.map((trip) => {
                    const active = selected?.visit.id === trip.visit.id;
                    const isPicked = picked.includes(trip.visit.id);
                    return (
                      <li key={trip.visit.id} className="relative flex items-center gap-1">
                        <span
                          className={`absolute -left-[1.03rem] top-3 size-2 rounded-full ${
                            active ? "bg-primary" : "bg-muted-foreground/40"
                          }`}
                        />
                        {mergeMode ? (
                          <Checkbox
                            checked={isPicked}
                            onCheckedChange={() => togglePick(trip.visit.id)}
                            aria-label="Markera resa för sammanslagning"
                            className="shrink-0"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            mergeMode ? togglePick(trip.visit.id) : setSelectedId(trip.visit.id)
                          }
                          aria-pressed={mergeMode ? isPicked : active}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                            (mergeMode ? isPicked : active)
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/60 hover:bg-muted/50"
                          }`}
                        >

                          <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                            {timeLabel(trip.visit.arrived_at)}
                            {trip.visit.left_at ? `–${timeLabel(trip.visit.left_at)}` : "–nu"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              {(() => {
                                const ModeIcon =
                                  MODE_ICONS[trip.visit.travel_mode ?? "okant"];
                                return (
                                  <ModeIcon
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                    aria-label={travelModeLabel(trip.visit.travel_mode)}
                                  />
                                );
                              })()}

                              <span className="truncate">
                                {trip.visit.label
                                  ? `${trip.visit.label} · `
                                  : ""}
                                {endpointName(trip.start, places, "Okänd start")} →{" "}
                                {endpointName(trip.end, places, "Okänt mål")}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs tabular-nums">
                            <span className="flex items-center justify-end gap-1 font-medium">
                              {trip.visit.distance_verified ? (
                                <BadgeCheck
                                  className="size-3.5 text-emerald-500"
                                  aria-label="Avståndet är kontrollerat"
                                />
                              ) : null}
                              {formatDistance(trip.visit.distance_m ?? 0)}
                            </span>
                            <span className="block text-muted-foreground">
                              {formatDuration(visitMinutes(trip.visit))}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(trip.visit)}
                          aria-label="Redigera resa"
                          className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      <EditTripDialog trip={editing} places={places} onClose={() => setEditing(null)} />
    </section>

  );
}

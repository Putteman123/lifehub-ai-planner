import { useMemo, useState } from "react";
import { Car, ChevronDown, MapPin, Pencil, Search, Trash2 } from "lucide-react";

import { EditTripDialog } from "@/components/platser/EditTripDialog";
import { EditVisitDialog } from "@/components/platser/EditVisitDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteRow, useVisits } from "@/lib/db";
import {
  PLACE_KINDS,
  formatDistance,
  formatDuration,
  isTravel,
  timeLabel,
  travelModeLabel,
  visitLabel,
  visitMinutes,
  type PlaceRow,
  type VisitRow,
} from "@/lib/geo";

const RANGES = [
  { value: "7", label: "7 dagar" },
  { value: "30", label: "30 dagar" },
  { value: "all", label: "Allt" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const PAGE = 40;

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Alla registrerade besök – sökbar, filtrerbar och redigerbar logg. */
export function VisitLogList({ places }: { places: PlaceRow[] }) {
  const [range, setRange] = useState<Range>("30");
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editVisit, setEditVisit] = useState<VisitRow | null>(null);
  const [editTrip, setEditTrip] = useState<VisitRow | null>(null);

  const since =
    range === "all"
      ? undefined
      : new Date(Date.now() - Number(range) * 86400000).toISOString();
  const visitsQ = useVisits(since);
  const deleteVisit = useDeleteRow("visits", "Besök borttaget");

  const all = visitsQ.data ?? [];
  const now = new Date();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((v) => (onlyUnknown ? v.place_id == null : true))
      .filter((v) => {
        if (!q) return true;
        return `${v.label ?? ""} ${v.note ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
  }, [all, onlyUnknown, query]);

  const shown = filtered.slice(0, limit);

  const groups: { key: string; label: string; items: VisitRow[] }[] = [];
  for (const visit of shown) {
    const key = dayKey(visit.arrived_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(visit);
    else groups.push({ key, label: dayLabel(visit.arrived_at), items: [visit] });
  }

  const colorFor = (visit: VisitRow) => {
    const place = places.find((p) => p.id === visit.place_id);
    if (place) return place.color;
    return PLACE_KINDS.find((k) => k.value === "annat")?.color ?? "#64748b";
  };

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Alla registrerade besök</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} poster</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setRange(r.value);
                setLimit(PAGE);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setOnlyUnknown((v) => !v);
            setLimit(PAGE);
          }}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            onlyUnknown
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          Visa bara okända
        </button>
      </div>

      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Sök plats eller aktivitet"
          className="pl-9"
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </div>

      {visitsQ.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Hämtar besök…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Inga besök i urvalet. Prova ett längre tidsintervall.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((group, groupIndex) => {
            const trips = group.items.filter((v) => isTravel(v));
            const stops = group.items.filter((v) => !isTravel(v));
            const meters = trips.reduce((sum, v) => sum + (v.distance_m ?? 0), 0);
            const minutes = group.items.reduce((sum, v) => sum + visitMinutes(v, now), 0);
            const open = openDays[group.key] ?? groupIndex === 0;
            return (
            <div key={group.key} className="rounded-2xl border border-border/70 bg-surface/60">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                onClick={() =>
                  setOpenDays((prev) => ({ ...prev, [group.key]: !open }))
                }
              >
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    open ? "" : "-rotate-90"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold capitalize">
                    {group.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {stops.length} platser · {trips.length} resor ·{" "}
                    {formatDistance(meters)} · {formatDuration(minutes)}
                  </span>
                </span>
              </button>
              {open ? (
              <ul className="grid gap-2 px-3 pb-3">
                {group.items.map((visit) => {
                  const travel = isTravel(visit);
                  return (
                    <li
                      key={visit.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(visit) }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => (travel ? setEditTrip(visit) : setEditVisit(visit))}
                      >
                        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {travel ? (
                            <Car className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {visitLabel(visit, places)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {timeLabel(visit.arrived_at)}–
                          {visit.left_at ? timeLabel(visit.left_at) : "pågår"} ·{" "}
                          {formatDuration(visitMinutes(visit, now))}
                          {travel
                            ? ` · ${formatDistance(visit.distance_m)} · ${travelModeLabel(
                                visit.travel_mode,
                              )}`
                            : ""}
                          {visit.note ? ` · ${visit.note}` : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Redigera besök"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => (travel ? setEditTrip(visit) : setEditVisit(visit))}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Ta bort besök"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Ta bort det här besöket?")) deleteVisit.mutate(visit.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              ) : null}
            </div>
            );
          })}


          {filtered.length > shown.length ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              Visa fler ({filtered.length - shown.length} kvar)
            </Button>
          ) : null}
        </div>
      )}

      <EditVisitDialog
        visit={editVisit}
        places={places}
        onClose={() => setEditVisit(null)}
      />
      <EditTripDialog trip={editTrip} places={places} onClose={() => setEditTrip(null)} />
    </section>
  );
}

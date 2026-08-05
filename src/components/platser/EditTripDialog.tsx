import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsertRow } from "@/lib/db";
import {
  distanceMatches,
  estimateRouteMeters,
  haversineMeters,
  TRAVEL_MODES,
  type PlaceRow,
  type TravelMode,
  type VisitRow,
} from "@/lib/geo";



/** ISO -> värde för <input type="datetime-local"> i lokal tid. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

type Props = {
  trip: VisitRow | null;
  places: PlaceRow[];
  onClose: () => void;
};

/** Redigera en registrerad resa: tider, start-/slutplats, tagg och avstånd. */
export function EditTripDialog({ trip, places, onClose }: Props) {
  const upsert = useUpsertRow("visits", "Resan uppdaterad");
  const logEdits = useLogTripEdits();
  const history = useTripHistory(trip?.id ?? null);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [startPlace, setStartPlace] = useState("");
  const [endPlace, setEndPlace] = useState("");
  const [label, setLabel] = useState("");
  const [km, setKm] = useState("");
  const [verified, setVerified] = useState(false);
  const [kmTouched, setKmTouched] = useState(false);
  const [verifiedTouched, setVerifiedTouched] = useState(false);
  const [mode, setMode] = useState<TravelMode>("bil");


  useEffect(() => {
    if (!trip) return;
    setStartAt(toLocalInput(trip.arrived_at));
    setEndAt(toLocalInput(trip.left_at));
    setStartPlace(
      places.find(
        (p) =>
          trip.lat != null &&
          trip.lng != null &&
          haversineMeters(trip.lat, trip.lng, p.lat, p.lng) <= Math.max(p.radius_m, 200),
      )?.id ?? "",
    );
    setEndPlace(
      places.find(
        (p) =>
          trip.end_lat != null &&
          trip.end_lng != null &&
          haversineMeters(trip.end_lat, trip.end_lng, p.lat, p.lng) <=
            Math.max(p.radius_m, 200),
      )?.id ?? "",
    );
    setLabel(trip.label ?? "");
    setKm(((trip.distance_m ?? 0) / 1000).toFixed(1).replace(".", ","));
    setVerified(trip.distance_verified ?? false);
    setMode(trip.travel_mode ?? "bil");

    setKmTouched(false);
    setVerifiedTouched(false);
  }, [trip, places]);

  const startPoint = places.find((p) => p.id === startPlace)
    ?? (trip && trip.lat != null && trip.lng != null
      ? { lat: trip.lat, lng: trip.lng }
      : null);
  const endPoint = places.find((p) => p.id === endPlace)
    ?? (trip && trip.end_lat != null && trip.end_lng != null
      ? { lat: trip.end_lat, lng: trip.end_lng }
      : null);

  const crowMeters =
    startPoint && endPoint
      ? Math.round(haversineMeters(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng))
      : null;
  const estimateMeters =
    startPoint && endPoint
      ? estimateRouteMeters(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng)
      : null;

  // Fyll i beräknat avstånd automatiskt så länge fältet inte redigerats manuellt.
  useEffect(() => {
    if (estimateMeters == null || kmTouched) return;
    setKm((estimateMeters / 1000).toFixed(1).replace(".", ","));
  }, [estimateMeters, kmTouched]);

  const enteredMeters = Math.max(0, Math.round(Number(km.replace(",", ".")) * 1000) || 0);
  const autoMatches =
    estimateMeters != null && distanceMatches(enteredMeters, estimateMeters);

  // Bocka i/ur "avståndet stämmer" automatiskt tills användaren väljer själv.
  useEffect(() => {
    if (estimateMeters == null || verifiedTouched) return;
    setVerified(autoMatches);
  }, [autoMatches, estimateMeters, verifiedTouched]);

  if (!trip) return null;


  const start = places.find((p) => p.id === startPlace);
  const end = places.find((p) => p.id === endPlace);

  const save = async () => {
    const meters = Math.max(0, Math.round(Number(km.replace(",", ".")) * 1000) || 0);
    const nextArrived = fromLocalInput(startAt) ?? trip.arrived_at;
    const nextLeft = fromLocalInput(endAt);
    const changes: { field: string; old_value: string | null; new_value: string | null }[] = [];
    const push = (field: string, oldV: string | null, newV: string | null) => {
      if ((oldV ?? "") !== (newV ?? "")) changes.push({ field, old_value: oldV, new_value: newV });
    };
    const fmtTime = (iso: string | null) =>
      iso ? new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : null;
    const nameFor = (lat: number | null, lng: number | null) =>
      lat == null || lng == null
        ? null
        : places.find(
            (p) => haversineMeters(lat, lng, p.lat, p.lng) <= Math.max(p.radius_m, 200),
          )?.name ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

    push("arrived_at", fmtTime(trip.arrived_at), fmtTime(nextArrived));
    push("left_at", fmtTime(trip.left_at), fmtTime(nextLeft));
    push(
      "start_place",
      nameFor(trip.lat, trip.lng),
      start ? start.name : nameFor(trip.lat, trip.lng),
    );
    push(
      "end_place",
      nameFor(trip.end_lat, trip.end_lng),
      end ? end.name : nameFor(trip.end_lat, trip.end_lng),
    );
    push(
      "distance_m",
      `${((trip.distance_m ?? 0) / 1000).toFixed(1).replace(".", ",")} km`,
      `${(meters / 1000).toFixed(1).replace(".", ",")} km`,
    );
    push(
      "distance_verified",
      trip.distance_verified ? "Verifierat" : "Ej verifierat",
      verified ? "Verifierat" : "Ej verifierat",
    );

    await upsert.mutateAsync({
      id: trip.id,
      entry_kind: trip.entry_kind,
      arrived_at: nextArrived,
      left_at: nextLeft,
      lat: start ? start.lat : trip.lat,
      lng: start ? start.lng : trip.lng,
      end_lat: end ? end.lat : trip.end_lat,
      end_lng: end ? end.lng : trip.end_lng,
      place_id: end ? end.id : trip.place_id,
      label: label.trim() || null,
      distance_m: meters,
      distance_verified: verified,
      travel_mode: mode,

      is_manual: true,
    });
    await logEdits(trip.id, changes);
    onClose();
  };


  return (
    <Dialog open={!!trip} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redigera resa</DialogTitle>
          <DialogDescription>
            Justera tider, start- och slutplats, tagg samt avstånd.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trip-start">Start</Label>
              <Input
                id="trip-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-end">Slut</Label>
              <Input
                id="trip-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trip-from">Startplats</Label>
              <select
                id="trip-from"
                value={startPlace}
                onChange={(e) => setStartPlace(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Behåll position</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-to">Slutplats</Label>
              <select
                id="trip-to"
                value={endPlace}
                onChange={(e) => setEndPlace(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Behåll position</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-label">Tagg</Label>
            <Input
              id="trip-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="T.ex. Pendling, Klientmöte, Barnhämtning"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-mode">Färdsätt</Label>
            <select
              id="trip-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as TravelMode)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {TRAVEL_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>



          <div className="space-y-1.5">
            <Label htmlFor="trip-km">Avstånd (km)</Label>
            <Input
              id="trip-km"
              inputMode="decimal"
              value={km}
              onChange={(e) => {
                setKmTouched(true);
                setKm(e.target.value);
              }}
            />
            {estimateMeters != null ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Beräknat: {(estimateMeters / 1000).toFixed(1).replace(".", ",")} km
                  {crowMeters != null
                    ? ` (fågelväg ${(crowMeters / 1000).toFixed(1).replace(".", ",")} km)`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setKm((estimateMeters / 1000).toFixed(1).replace(".", ","));
                    setKmTouched(false);
                    setVerifiedTouched(false);
                    setVerified(true);
                  }}
                  className="rounded-md border border-border/60 px-2 py-0.5 text-xs font-medium hover:bg-muted"
                >
                  Återställ till beräknat
                </button>

              </div>
            ) : null}
            {estimateMeters != null && !autoMatches ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Avviker från beräknat avstånd
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => {
                setVerifiedTouched(true);
                setVerified(e.target.checked);
              }}
              className="size-4 accent-primary"
            />
            Avståndet stämmer (kontrollerat)
          </label>

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? "Sparar…" : "Spara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

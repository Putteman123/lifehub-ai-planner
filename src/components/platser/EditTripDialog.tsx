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
  type PlaceRow,
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
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [startPlace, setStartPlace] = useState("");
  const [endPlace, setEndPlace] = useState("");
  const [label, setLabel] = useState("");
  const [km, setKm] = useState("");
  const [verified, setVerified] = useState(false);

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
  }, [trip, places]);

  if (!trip) return null;

  const start = places.find((p) => p.id === startPlace);
  const end = places.find((p) => p.id === endPlace);

  const save = async () => {
    const meters = Math.max(0, Math.round(Number(km.replace(",", ".")) * 1000) || 0);
    await upsert.mutateAsync({
      id: trip.id,
      entry_kind: trip.entry_kind,
      arrived_at: fromLocalInput(startAt) ?? trip.arrived_at,
      left_at: fromLocalInput(endAt),
      lat: start ? start.lat : trip.lat,
      lng: start ? start.lng : trip.lng,
      end_lat: end ? end.lat : trip.end_lat,
      end_lng: end ? end.lng : trip.end_lng,
      place_id: end ? end.id : trip.place_id,
      label: label.trim() || null,
      distance_m: meters,
      distance_verified: verified,
      is_manual: true,
    });
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
            <Label htmlFor="trip-km">Avstånd (km)</Label>
            <Input
              id="trip-km"
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
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

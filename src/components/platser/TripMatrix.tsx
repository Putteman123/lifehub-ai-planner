import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { NavigateButton } from "@/components/maps/NavigateButton";
import { PlaceSearchInput, type PickedPlace } from "@/components/maps/PlaceSearchInput";
import { StreetViewImage } from "@/components/maps/StreetViewImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { distanceMatrix } from "@/lib/maps.functions";

type TripRow = {
  id: string;
  from_label: string;
  from_lat: number | null;
  from_lng: number | null;
  to_label: string;
  to_lat: number | null;
  to_lng: number | null;
  driven_on: string;
  driven_km: number;
  purpose: string | null;
};

const EMPTY = {
  fromLabel: "",
  from: null as PickedPlace | null,
  toLabel: "",
  to: null as PickedPlace | null,
  date: new Date().toISOString().slice(0, 10),
  mil: "",
  purpose: "",
};

function useTrips() {
  return useQuery({
    queryKey: ["trip_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_logs")
        .select(
          "id,from_label,from_lat,from_lng,to_label,to_lat,to_lng,driven_on,driven_km,purpose",
        )
        .order("driven_on", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as TripRow[];
    },
  });
}

/** Resedagbok där körda mil jämförs mot Googles beräknade rutt. */
export function TripMatrix() {
  const qc = useQueryClient();
  const tripsQ = useTrips();
  const trips = useMemo(() => tripsQ.data ?? [], [tripsQ.data]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const matrix = useServerFn(distanceMatrix);

  // Googles sträcka och restid för varje sparad resa med koordinater.
  const routed = useQuery({
    queryKey: ["trip-matrix", trips.map((t) => t.id).join(",")],
    enabled: trips.some((t) => t.from_lat != null && t.to_lat != null),
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const result: Record<string, { meters: number; minutes: number }> = {};
      const withCoords = trips.filter((t) => t.from_lat != null && t.to_lat != null).slice(0, 40);
      for (const trip of withCoords) {
        const cells = await matrix({
          data: {
            origins: [{ lat: trip.from_lat!, lng: trip.from_lng! }],
            destinations: [{ lat: trip.to_lat!, lng: trip.to_lng! }],
            mode: "bil" as const,
          },
        }).catch(() => []);
        const cell = cells[0];
        if (cell) result[trip.id] = { meters: cell.meters, minutes: cell.minutes };
      }
      return result;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Du är inte inloggad.");
      const mil = Number(form.mil.replace(",", "."));
      if (!form.fromLabel.trim() || !form.toLabel.trim())
        throw new Error("Fyll i både från och till.");
      if (!Number.isFinite(mil) || mil < 0) throw new Error("Ange körda mil som ett tal.");

      const { error } = await supabase.from("trip_logs").insert({
        user_id: auth.user.id,
        from_label: form.from?.name ?? form.fromLabel.trim(),
        from_lat: form.from?.lat ?? null,
        from_lng: form.from?.lng ?? null,
        to_label: form.to?.name ?? form.toLabel.trim(),
        to_lat: form.to?.lat ?? null,
        to_lng: form.to?.lng ?? null,
        driven_on: form.date,
        driven_km: mil * 10,
        purpose: form.purpose.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setForm(EMPTY);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["trip_logs"] });
      toast.success("Resa sparad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trip_logs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip_logs"] });
      toast.success("Resa borttagen");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalMil = trips.reduce((sum, t) => sum + Number(t.driven_km), 0) / 10;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <RouteIcon className="size-4 shrink-0" /> Matrix – mina resor
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {trips.length} resor · {totalMil.toFixed(1)} mil totalt
            </p>
          </div>
          <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen(!open)}>
            <Plus className="size-4" />
            {open ? "Stäng" : "Ny resa"}
          </Button>
        </div>

        {open ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trip-from">Från</Label>
              <PlaceSearchInput
                id="trip-from"
                value={form.fromLabel}
                onChange={(v) => setForm({ ...form, fromLabel: v })}
                onPick={(p) => setForm({ ...form, from: p, fromLabel: p.name })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-to">Till</Label>
              <PlaceSearchInput
                id="trip-to"
                value={form.toLabel}
                onChange={(v) => setForm({ ...form, toLabel: v })}
                onPick={(p) => setForm({ ...form, to: p, toLabel: p.name })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="trip-date">Kördatum</Label>
                <Input
                  id="trip-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trip-mil">Körda mil</Label>
                <Input
                  id="trip-mil"
                  inputMode="decimal"
                  placeholder="2,5"
                  value={form.mil}
                  onChange={(e) => setForm({ ...form, mil: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-purpose">Syfte</Label>
              <Input
                id="trip-purpose"
                placeholder="T.ex. kundmöte"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </div>
            <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Spara resa
            </Button>
          </div>
        ) : null}
      </div>

      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inga resor sparade ännu. Lägg till din första resa så jämför appen dina mil mot Googles
          rutt.
        </p>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const google = routed.data?.[trip.id];
            const drivenMil = Number(trip.driven_km) / 10;
            const googleMil = google ? google.meters / 10000 : null;
            const diff = googleMil == null ? null : drivenMil - googleMil;

            return (
              <li key={trip.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {trip.from_label} → {trip.to_label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(trip.driven_on).toLocaleDateString("sv-SE")}
                      {trip.purpose ? ` · ${trip.purpose}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Ta bort resa"
                    onClick={() => remove.mutate(trip.id)}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-[11px] text-muted-foreground">Kört</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {drivenMil.toFixed(1)} mil
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-[11px] text-muted-foreground">Google</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {googleMil == null
                        ? routed.isFetching
                          ? "…"
                          : "–"
                        : `${googleMil.toFixed(1)} mil`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-[11px] text-muted-foreground">Skillnad</p>
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        diff == null
                          ? ""
                          : Math.abs(diff) > 1
                            ? "text-destructive"
                            : "text-primary"
                      }`}
                    >
                      {diff == null
                        ? "–"
                        : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} mil`}
                    </p>
                  </div>
                </div>

                {google ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Googles restid: {google.minutes} min
                  </p>
                ) : null}

                {trip.from_lat != null && trip.to_lat != null ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <StreetViewImage
                        lat={trip.from_lat}
                        lng={trip.from_lng!}
                        alt={`Gatubild vid ${trip.from_label}`}
                        className="h-24 w-full object-cover"
                      />
                      <StreetViewImage
                        lat={trip.to_lat}
                        lng={trip.to_lng!}
                        alt={`Gatubild vid ${trip.to_label}`}
                        className="h-24 w-full object-cover"
                      />
                    </div>
                    <NavigateButton lat={trip.to_lat} lng={trip.to_lng!} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default TripMatrix;

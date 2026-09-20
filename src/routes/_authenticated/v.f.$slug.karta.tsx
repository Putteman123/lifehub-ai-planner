import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { GoogleMap, type MapMarker } from "@/components/GoogleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "@/lib/geo";
import { geocodeClients, getCareMap, getDayRoute } from "@/lib/care-places.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/karta")({
  head: () => ({
    meta: [
      { title: "Karta & rutter – livo.health" },
      {
        name: "description",
        content: "Brukarnas adresser på karta och dagens körrutt per medarbetare.",
      },
      { property: "og:title", content: "Karta & rutter – livo.health" },
      {
        property: "og:description",
        content: "Brukarnas adresser på karta och dagens körrutt per medarbetare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareMapPage,
});

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TIME = (iso: string) =>
  new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

const ALL = "__all__";

function CareMapPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [staffId, setStaffId] = useState(ALL);

  const fetchMap = useServerFn(getCareMap);
  const fetchRoute = useServerFn(getDayRoute);
  const runGeocode = useServerFn(geocodeClients);

  const mapQ = useQuery({
    queryKey: ["care-map", slug, date],
    queryFn: () => fetchMap({ data: { slug, date } }),
  });

  const routeQ = useQuery({
    queryKey: ["care-route", slug, date, staffId],
    enabled: staffId !== ALL,
    queryFn: () => fetchRoute({ data: { slug, date, staffId } }),
  });

  const geocode = useMutation({
    mutationFn: () => runGeocode({ data: { slug } }),
    onSuccess: (res) => {
      toast.success(
        res.updated
          ? `${res.updated} adresser fick position.`
          : "Inga nya adresser kunde hittas.",
      );
      void qc.invalidateQueries({ queryKey: ["care-map", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clients = (mapQ.data?.clients ?? []) as Array<{
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
  }>;
  const visits = (mapQ.data?.visits ?? []) as Array<{
    id: string;
    client_id: string;
    staff_id: string | null;
    status: string;
    starts_at: string;
  }>;
  const staff = (mapQ.data?.staff ?? []) as Array<{ id: string; display_name: string | null }>;

  const markers: MapMarker[] = useMemo(() => {
    const stops = routeQ.data?.stops ?? [];
    if (staffId !== ALL && stops.length) {
      return stops
        .filter((s) => s.lat != null && s.lng != null)
        .map((s, i, arr) => ({
          lat: s.lat as number,
          lng: s.lng as number,
          title: `${TIME(s.starts_at)} ${s.clientName}`,
          ...(i === 0 ? { role: "start" as const } : i === arr.length - 1 ? { role: "slut" as const } : {}),
        }));
    }
    return clients
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => {
        const visit = visits.find((v) => v.client_id === c.id);
        return {
          lat: c.lat as number,
          lng: c.lng as number,
          title: visit ? `${c.name} · ${TIME(visit.starts_at)}` : c.name,
          ...(visit && !visit.staff_id ? { role: "slut" as const } : {}),
        };
      });
  }, [clients, visits, routeQ.data, staffId]);

  const polyline = routeQ.data?.legs?.find((l) => l.polyline)?.polyline ?? null;
  const totals = routeQ.data?.totals ?? null;
  const missing = mapQ.data?.missingPositions ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Karta & rutter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brukarna på karta och dagens körrutt per medarbetare.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Dag</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-44 space-y-1.5">
          <Label>Medarbetare</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alla brukare</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.display_name ?? "Namnlös"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {missing > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
          <p className="flex-1 text-sm">
            {missing} brukare har adress men saknar position på kartan.
          </p>
          <Button size="sm" disabled={geocode.isPending} onClick={() => geocode.mutate()}>
            {geocode.isPending ? "Hämtar…" : "Hämta positioner"}
          </Button>
        </div>
      ) : null}

      {mapQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : markers.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Ingen brukare har någon position ännu. Lägg in adress på brukarna och tryck på Hämta
          positioner.
        </p>
      ) : (
        <GoogleMap markers={markers} polyline={polyline} className="h-80 w-full rounded-3xl" />
      )}

      {staffId !== ALL ? (
        <section className="rounded-3xl border border-border/70 bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Dagens rutt</h2>
          {routeQ.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Räknar körsträcka…</p>
          ) : !routeQ.data?.stops.length ? (
            <p className="mt-2 text-sm text-muted-foreground">Inga besök den här dagen.</p>
          ) : (
            <>
              {totals ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {totals.stops} besök · {formatDistance(totals.meters)} ·{" "}
                  {totals.travelMinutes} min restid
                  {totals.tight ? ` · ${totals.tight} resa hinns inte med` : ""}
                </p>
              ) : null}
              <ol className="mt-3 space-y-2">
                {routeQ.data.stops.map((s, i) => {
                  const leg = i > 0 ? routeQ.data!.legs[i - 1] : null;
                  return (
                    <li key={s.visitId}>
                      {leg ? (
                        <p
                          className={`px-3 py-1 text-xs ${leg.tight ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          ↓ {formatDistance(leg.meters)} · {leg.minutes} min resa
                          {leg.tight
                            ? ` · bara ${leg.gapMinutes} min mellan besöken`
                            : ""}
                        </p>
                      ) : null}
                      <div className="rounded-2xl bg-secondary/50 p-3">
                        <p className="font-medium">
                          {TIME(s.starts_at)}–{TIME(s.ends_at)} {s.clientName}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {s.address ?? "Adress saknas"}
                        </p>
                        {s.address ? (
                          <a
                            className="mt-1 inline-block text-xs font-medium text-primary"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Navigera hit
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

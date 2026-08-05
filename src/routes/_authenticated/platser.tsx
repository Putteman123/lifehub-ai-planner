import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteRow, useEvents, usePlaces, useUpsertRow, useVisits } from "@/lib/db";
import {
  PLACE_KINDS,
  type PlaceKind,
  type PlaceRow,
  formatDuration,
  kindLabel,
  minutesByKind,
  startOfDay,
  startOfWeek,
  timeLabel,
  visitLabel,
  visitMinutes,
} from "@/lib/geo";
import {
  clearLocationHistory,
  endMyVisit,
  getIngestInfo,
  recordMyPosition,
} from "@/lib/places.functions";

export const Route = createFileRoute("/_authenticated/platser")({
  head: () => ({
    meta: [
      { title: "Platser – LifeHub AI" },
      {
        name: "description",
        content: "Platslogg som registrerar var du är, hur länge och hur tiden fördelas.",
      },
      { property: "og:title", content: "Platser – LifeHub AI" },
      {
        property: "og:description",
        content: "Automatisk arbetstid, reselogg och jämförelse mot kalendern.",
      },
    ],
  }),
  component: PlacesPage,
});

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Platstjänster stöds inte i den här webbläsaren."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(err.message)), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });
}

function PlacesPage() {
  const placesQ = usePlaces();
  const weekStart = startOfWeek(new Date());
  const visitsQ = useVisits(new Date(weekStart.getTime() - 7 * 86400000).toISOString());
  const eventsQ = useEvents();

  const places = placesQ.data ?? [];
  const visits = visitsQ.data ?? [];
  const events = eventsQ.data ?? [];

  const qc = useQueryClient();
  const record = useServerFn(recordMyPosition);
  const leave = useServerFn(endMyVisit);
  const clearHistory = useServerFn(clearLocationHistory);
  const ingest = useServerFn(getIngestInfo);

  const upsertPlace = useUpsertRow("places", "Plats sparad");
  const deletePlace = useDeleteRow("places", "Plats borttagen");
  const deleteVisit = useDeleteRow("visits", "Besök borttaget");

  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [ingestUrl, setIngestUrl] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSent = useRef(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlaceRow | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("jobb");
  const [radius, setRadius] = useState("150");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [address, setAddress] = useState("");

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["visits"] });
  }

  async function checkIn(source: "app" | "live" = "app") {
    const pos = await currentPosition();
    await record({
      data: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
        source,
      },
    });
    await refresh();
  }

  async function handleCheckIn() {
    setBusy("in");
    try {
      await checkIn("app");
      toast.success("Position registrerad");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte hämta position");
    } finally {
      setBusy(null);
    }
  }

  async function handleLeave() {
    setBusy("ut");
    try {
      const res = await leave({});
      await refresh();
      toast.success(res.closed ? "Besöket avslutat" : "Inget pågående besök");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte avsluta besöket");
    } finally {
      setBusy(null);
    }
  }

  // Live-läge: position var annan minut så länge appen är öppen.
  useEffect(() => {
    if (!live) {
      if (watchRef.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Platstjänster stöds inte här.");
      setLive(false);
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 120000) return;
        lastSent.current = now;
        void record({
          data: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy ?? null,
            source: "live",
          },
        }).then(refresh);
      },
      (err) => {
        toast.error(err.message);
        setLive(false);
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  function openNew() {
    setEditing(null);
    setName("");
    setKind("jobb");
    setRadius("150");
    setLat("");
    setLng("");
    setAddress("");
    setDialogOpen(true);
  }

  function openEdit(place: PlaceRow) {
    setEditing(place);
    setName(place.name);
    setKind(place.kind);
    setRadius(String(place.radius_m));
    setLat(String(place.lat));
    setLng(String(place.lng));
    setAddress(place.address ?? "");
    setDialogOpen(true);
  }

  async function useMyPosition() {
    try {
      const pos = await currentPosition();
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
      toast.success("Position hämtad");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte hämta position");
    }
  }

  async function savePlace() {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!name.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      toast.error("Fyll i namn och koordinater.");
      return;
    }
    await upsertPlace.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      name: name.trim(),
      kind,
      radius_m: Math.max(30, Number(radius) || 150),
      lat: latNum,
      lng: lngNum,
      address: address.trim() || null,
      color: PLACE_KINDS.find((k) => k.value === kind)?.color ?? "#3b82f6",
    });
    setDialogOpen(false);
  }

  async function showIngest() {
    try {
      const info = await ingest({});
      setIngestUrl(info.url);
    } catch {
      toast.error("Kunde inte hämta adressen.");
    }
  }

  async function wipe() {
    if (!confirm("Radera all platshistorik? Detta går inte att ångra.")) return;
    await clearHistory({});
    await refresh();
    toast.success("Historiken är raderad");
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayVisits = visits
    .filter((v) => new Date(v.left_at ?? now).getTime() >= todayStart.getTime())
    .sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
  const openVisit = visits.find((v) => !v.left_at) ?? null;

  const today = minutesByKind(visits, places, todayStart, now, now);
  const week = minutesByKind(visits, places, weekStart, now, now);

  const todayEvents = events.filter((e) => {
    const start = new Date(e.starts_at);
    return start >= todayStart && start < new Date(todayStart.getTime() + 86400000);
  });

  return (
    <AppShell
      title="Platser"
      subtitle="Var du är, hur länge – och hur tiden fördelar sig"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleCheckIn} disabled={busy === "in"}>
            {busy === "in" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MapPin className="size-4" />
            )}
            Jag är här
          </Button>
          <Button size="sm" variant="outline" onClick={handleLeave} disabled={busy === "ut"}>
            <LogOut className="size-4" />
            Jag går nu
          </Button>
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="size-4" />
            Plats
          </Button>
        </div>
      }
    >
      <DataGate queries={[placesQ, visitsQ, eventsQ]}>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Dagens reselogg</h2>
              {openVisit ? (
                <span className="rounded-full bg-cat-ledig/12 px-2.5 py-1 text-xs font-medium text-cat-ledig">
                  Nu: {visitLabel(openVisit, places)} ·{" "}
                  {formatDuration(visitMinutes(openVisit, now))}
                </span>
              ) : null}
            </div>

            {todayVisits.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Inga besök registrerade i dag. Tryck på ”Jag är här” eller slå på live-läget.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {todayVisits.map((visit) => (
                  <li
                    key={visit.id}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                  >
                    <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {timeLabel(visit.arrived_at)}
                      {visit.left_at ? `–${timeLabel(visit.left_at)}` : "–nu"}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {visitLabel(visit, places)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(visitMinutes(visit, now))}
                    </span>
                    <button
                      type="button"
                      aria-label="Ta bort besök"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => deleteVisit.mutate(visit.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {todayEvents.length > 0 && todayVisits.length > 0 ? (
              <div className="mt-5 border-t border-border/70 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mot kalendern
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {todayEvents.map((event) => {
                    const start = new Date(event.starts_at);
                    const at = todayVisits.find(
                      (v) =>
                        new Date(v.arrived_at) <= start &&
                        new Date(v.left_at ?? now) >= start,
                    );
                    return (
                      <li key={event.id} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {timeLabel(event.starts_at)} {event.title}
                        </span>{" "}
                        – {at ? `du var på ${visitLabel(at, places)}` : "ingen plats registrerad"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Tid i dag</h2>
              <ul className="mt-3 space-y-1.5">
                {PLACE_KINDS.map((k) => (
                  <li key={k.value} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: k.color }}
                      />
                      {k.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatDuration(today[k.value])}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Denna vecka
              </h3>
              <ul className="mt-2 space-y-1.5">
                {PLACE_KINDS.filter((k) => week[k.value] > 0).map((k) => (
                  <li key={k.value} className="flex items-center justify-between text-sm">
                    <span>{k.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatDuration(week[k.value])}
                    </span>
                  </li>
                ))}
                {PLACE_KINDS.every((k) => week[k.value] === 0) ? (
                  <li className="text-sm text-muted-foreground">Inget registrerat än.</li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Radio className="size-4" /> Live-läge
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Loggar var ~2:a minut medan appen är öppen.
                  </p>
                </div>
                <Switch checked={live} onCheckedChange={setLive} aria-label="Live-läge" />
              </div>
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mina platser</h2>
            <Button size="sm" variant="ghost" onClick={openNew}>
              <Plus className="size-4" /> Ny plats
            </Button>
          </div>
          {places.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Lägg till Jobbet, Tingsrätten och Hemma så namnges besöken automatiskt.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {places.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: place.color }}
                  />
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-sm font-medium"
                    onClick={() => openEdit(place)}
                  >
                    {place.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {kindLabel(place.kind)} · {place.radius_m} m
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Ta bort plats"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deletePlace.mutate(place.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Automatisk loggning från telefonen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            En webbapp kan inte spåra i bakgrunden. Låt telefonen skicka positionen till din
            privata adress i stället – gratis, och den fungerar med låst skärm.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={showIngest}>
              Visa min privata adress
            </Button>
            {ingestUrl ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(ingestUrl);
                  toast.success("Adressen kopierad");
                }}
              >
                <Copy className="size-4" /> Kopiera
              </Button>
            ) : null}
          </div>
          {ingestUrl ? (
            <code className="mt-2 block break-all rounded-lg bg-muted px-3 py-2 text-xs">
              {ingestUrl}
            </code>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                OwnTracks (rekommenderas)
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Installera OwnTracks från App Store (gratis).</li>
                <li>Inställningar → Mode → välj <strong>HTTP</strong>.</li>
                <li>Klistra in adressen ovan i fältet <strong>URL</strong>.</li>
                <li>Sätt Locator till <strong>Move</strong> eller <strong>Significant</strong>.</li>
                <li>Tillåt plats <strong>Alltid</strong> när iOS frågar.</li>
              </ol>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Genvägar (utan extra app)
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Genvägar → Automation → Ny personlig automation.</li>
                <li>Välj t.ex. <strong>Ankomst</strong> till en plats.</li>
                <li>Lägg till <strong>Hämta aktuell plats</strong>.</li>
                <li>
                  Lägg till <strong>Hämta innehåll från URL</strong>: metod POST, JSON med
                  fälten <code>lat</code> och <code>lon</code> från platsen.
                </li>
                <li>Slå av ”Fråga innan körning”.</li>
              </ol>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
            <p className="text-xs text-muted-foreground">
              Platsdata ligger bara i din egen databas och delas aldrig vidare.
            </p>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={wipe}>
              Radera all historik
            </Button>
          </div>
        </section>
      </DataGate>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera plats" : "Ny plats"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="place-name">Namn</Label>
              <Input
                id="place-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jobbet"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="place-address">Adress (valfritt)</Label>
              <Input
                id="place-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="place-lat">Latitud</Label>
                <Input id="place-lat" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="place-lng">Longitud</Label>
                <Input id="place-lng" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={useMyPosition}>
              <MapPin className="size-4" /> Använd min position nu
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Typ</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as PlaceKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACE_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="place-radius">Radie (m)</Label>
                <Input
                  id="place-radius"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={savePlace}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

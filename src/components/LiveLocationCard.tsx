import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, ExternalLink, MapPin, X } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { reverseGeocode } from "@/lib/maps.functions";

const GoogleMap = lazy(() =>
  import("@/components/GoogleMap").then((m) => ({ default: m.GoogleMap })),
);

type Fix = { lat: number; lng: number; accuracy: number };

/** Knapp på översikten som öppnar en livekarta över enhetens position. */
export function LiveLocationCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        aria-label="Visa var jag är nu på karta"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15">
            <MapPin className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Var är jag nu</span>
            <span className="block text-xs opacity-80">Livekarta med din position</span>
          </span>
        </span>
        <Crosshair className="size-5 shrink-0 opacity-80" />
      </button>

      {open ? <LiveLocationSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LiveLocationSheet({ onClose }: { onClose: () => void }) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Den här enheten stöder inte platsdelning.");
      return;
    }
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setError(null);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Platsdelning är nekad. Tillåt platsåtkomst för LifeHub i inställningarna."
            : "Kunde inte hämta din position just nu.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [attempt]);

  // Grovt rutnät (~50 m) så adressuppslaget inte görs om vid varje GPS-tick.
  const cell = fix ? `${fix.lat.toFixed(3)},${fix.lng.toFixed(3)}` : null;
  const lookup = useServerFn(reverseGeocode);
  const addressQ = useQuery({
    queryKey: ["live-address", cell],
    enabled: cell != null,
    staleTime: 1000 * 60 * 10,
    queryFn: () => lookup({ data: { lat: fix!.lat, lng: fix!.lng } }),
  });

  const markers = useMemo(
    () => (fix ? [{ lat: fix.lat, lng: fix.lng, title: "Du är här", role: "self" as const }] : []),
    [fix],
  );
  const onUserPan = useCallback(() => setFollow(false), []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold">Var är jag nu</h2>
            <p className="truncate text-xs text-muted-foreground">
              {addressQ.data?.address ?? (fix ? "Hämtar adress…" : "Söker position…")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng kartan"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
                Försök igen
              </Button>
            </div>
          ) : !fix ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Söker din position…
            </div>
          ) : (
            <ClientOnly fallback={null}>
              <Suspense fallback={null}>
                <GoogleMap
                  className="h-full w-full"
                  markers={markers}
                  accuracy={fix.accuracy}
                  follow={follow}
                  onUserPan={onUserPan}
                  zoom={16}
                />
              </Suspense>
            </ClientOnly>
          )}

          {fix && !follow ? (
            <button
              type="button"
              onClick={() => setFollow(true)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-medium shadow-md"
            >
              <Crosshair className="size-3.5" /> Centrera
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {fix ? `±${fix.accuracy} m · ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : "—"}
          </span>
          {fix ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${fix.lat}%2C${fix.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <ExternalLink className="size-3.5" /> Öppna i Google Maps
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LiveLocationCard;

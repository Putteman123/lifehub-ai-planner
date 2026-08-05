import { useEffect, useRef, useState } from "react";

export type MapMarker = {
  lat: number;
  lng: number;
  title?: string;
  /** Färgad markör: "start" | "slut" | undefined (standard). */
  role?: "start" | "slut";
};

declare global {
  interface Window {
    google?: typeof google;
    __lifehubMapsReady?: () => void;
  }
}

const BROWSER_KEY = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;
const CHANNEL = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
  | string
  | undefined;

let loader: Promise<void> | null = null;

/** Laddar Maps JS API en gång per session. */
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Ingen webbläsare"));
  if (window.google?.maps) return Promise.resolve();
  if (loader) return loader;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps-nyckel saknas"));

  loader = new Promise<void>((resolve, reject) => {
    window.__lifehubMapsReady = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      libraries: "geometry",
      language: "sv",
      region: "SE",
      callback: "__lifehubMapsReady",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Kunde inte ladda Google Maps"));
    document.head.appendChild(script);
  });
  return loader;
}

/** Google-karta med markörer och valfri ritad rutt. */
export function GoogleMap({
  markers,
  polyline = null,
  className = "h-64 w-full",
  zoom = 15,
  accuracy = null,
  follow = false,
  onUserPan,
}: {
  markers: MapMarker[];
  polyline?: string | null;
  className?: string;
  zoom?: number;
  /** Radie i meter för positionens osäkerhet (ritas som cirkel runt första markören). */
  accuracy?: number | null;
  /** Håll kartan centrerad på första markören. */
  follow?: boolean;
  /** Anropas när användaren själv drar i kartan. */
  onUserPan?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: google.maps.Map | null) => void }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !ref.current || markers.length === 0) return;
    const maps = window.google!.maps;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(ref.current, {
        center: { lat: markers[0]!.lat, lng: markers[0]!.lng },
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
      });
    }
    const map = mapRef.current;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const bounds = new maps.LatLngBounds();
    for (const marker of markers) {
      const position = { lat: marker.lat, lng: marker.lng };
      const created = new maps.Marker({
        map,
        position,
        ...(marker.title ? { title: marker.title } : {}),
        ...(marker.role
          ? {
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: marker.role === "self" ? 7 : 8,
                fillColor:
                  marker.role === "start"
                    ? "#22c55e"
                    : marker.role === "self"
                      ? "#2563eb"
                      : "#ef4444",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              },
              zIndex: 10,
            }
          : {}),
      });
      overlaysRef.current.push(created);
      bounds.extend(position);
    }

    if (accuracy && accuracy > 0 && markers[0]) {
      const circle = new maps.Circle({
        map,
        center: { lat: markers[0].lat, lng: markers[0].lng },
        radius: accuracy,
        strokeColor: "#2563eb",
        strokeOpacity: 0.4,
        strokeWeight: 1,
        fillColor: "#2563eb",
        fillOpacity: 0.12,
      });
      overlaysRef.current.push(circle);
    }

    if (polyline && maps.geometry?.encoding) {
      const path = maps.geometry.encoding.decodePath(polyline);
      const line = new maps.Polyline({
        map,
        path,
        strokeColor: "#4f46e5",
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      overlaysRef.current.push(line);
      for (const point of path) bounds.extend(point);
    }

    if (markers.length > 1 || polyline) {
      map.fitBounds(bounds, 40);
    } else if (follow || !fittedRef.current) {
      map.setCenter({ lat: markers[0]!.lat, lng: markers[0]!.lng });
      if (!fittedRef.current) map.setZoom(zoom);
    }
    fittedRef.current = true;
  }, [ready, markers, polyline, zoom, accuracy, follow]);

  // Upptäcker att användaren själv panorerar kartan.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !onUserPan) return;
    const listener = map.addListener("dragstart", () => onUserPan());
    return () => listener.remove();
  }, [ready, onUserPan]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground ${className}`}
      >
        Kartan kunde inte laddas ({error}).
      </div>
    );
  }

  return <div ref={ref} className={className} aria-label="Karta" role="img" />;
}

export default GoogleMap;

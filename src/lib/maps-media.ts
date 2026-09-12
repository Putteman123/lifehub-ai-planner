/**
 * Kartbilder och navigering i webbläsaren.
 * Använder i första hand din egna Google-nyckel, annars Lovables nyckel.
 */

const OWN_KEY = import.meta.env["VITE_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
const LOVABLE_KEY = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;

export const USING_OWN_MAPS_KEY = Boolean(OWN_KEY);
export const BROWSER_MAPS_KEY = OWN_KEY || LOVABLE_KEY;

/** Gatubild för en koordinat (Street View Static API). */
export function streetViewUrl(
  lat: number,
  lng: number,
  size: { width: number; height: number } = { width: 640, height: 320 },
) {
  if (!OWN_KEY) return null;
  const params = new URLSearchParams({
    size: `${size.width}x${size.height}`,
    location: `${lat},${lng}`,
    fov: "80",
    pitch: "0",
    return_error_code: "true",
    source: "outdoor",
    key: OWN_KEY,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/** Liten kartbild för listor (Maps Static API). */
export function staticMapUrl(
  lat: number,
  lng: number,
  options: { zoom?: number; width?: number; height?: number } = {},
) {
  if (!OWN_KEY) return null;
  const { zoom = 15, width = 320, height = 160 } = options;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: "2",
    language: "sv",
    region: "SE",
    markers: `color:0x4f46e5|${lat},${lng}`,
    key: OWN_KEY,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Länk som startar navigering i Google Maps-appen. */
export function navigationUrl(
  destination: { lat: number; lng: number } | string,
  mode: "driving" | "walking" | "transit" | "bicycling" = "driving",
) {
  const target =
    typeof destination === "string"
      ? destination
      : `${destination.lat},${destination.lng}`;
  const params = new URLSearchParams({
    api: "1",
    destination: target,
    travelmode: mode,
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Länk som startar navigering i Waze. */
export function wazeUrl(destination: { lat: number; lng: number }) {
  return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
}

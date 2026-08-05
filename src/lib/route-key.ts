import type { PlaceRow } from "./geo";

/** Namnger en punkt efter närmaste sparade plats, annars grovt rutnät. */
export function endpointKey(
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
  if (best) return best.name;
  // Gruppera okända punkter i ~500 m rutor så återkommande resvägar ändå matchar.
  return `Okänd plats (${point.lat.toFixed(2)}, ${point.lng.toFixed(2)})`;
}

export const WEEKDAYS = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];

/** Måndag = 0 … söndag = 6. */
export function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

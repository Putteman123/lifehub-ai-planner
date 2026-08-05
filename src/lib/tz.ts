/**
 * Tidszonshjälp. Servern kör i UTC, men allt Andrea läser och skriver
 * ska tolkas som svensk lokaltid.
 */
export const APP_TZ = "Europe/Stockholm";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Hur många ms svensk tid ligger före UTC vid en viss tidpunkt. */
function offsetMs(at: Date): number {
  const p = Object.fromEntries(
    PARTS.formatToParts(at).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"]) % 24,
    Number(p["minute"]),
    Number(p["second"]),
  );
  return asUtc - at.getTime();
}

const HAS_ZONE = /(z|[+-]\d{2}:?\d{2})$/i;

/** Tolkar en tidssträng. Saknas tidszon räknas den som svensk lokaltid. */
export function parseLocal(value: string): Date {
  const raw = value.trim();
  if (HAS_ZONE.test(raw)) return new Date(raw);

  const naive = new Date(`${raw.includes("T") ? raw : `${raw}T00:00:00`}Z`);
  if (Number.isNaN(naive.getTime())) return new Date(NaN);

  // Två steg så att sommartidsskiften hamnar rätt.
  const first = new Date(naive.getTime() - offsetMs(naive));
  return new Date(naive.getTime() - offsetMs(first));
}

/** Formaterar en tid i svensk tidszon. */
export function fmtLocal(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("sv-SE", { timeZone: APP_TZ, ...opts });
}

export function timeLocal(value: string | Date): string {
  return fmtLocal(value, { hour: "2-digit", minute: "2-digit" });
}

export function dateLocal(value: string | Date): string {
  return fmtLocal(value, { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Svensk kalenderdag som YYYY-MM-DD, oberoende av serverns tidszon. */
export function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function weekdayLocal(value: string | Date): string {
  return fmtLocal(value, { weekday: "long", day: "numeric", month: "short" });
}

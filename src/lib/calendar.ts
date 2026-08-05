import {
  addDays,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { sv } from "date-fns/locale";

import { categoryMeta, SHIFT_STYLES, type EventRow, type ShiftType } from "./categories";

export const svLocale = sv;

export function fmt(date: Date | string, pattern: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern, { locale: sv });
}

export function timeRange(event: EventRow) {
  if (event.all_day) return "Heldag";
  return `${fmt(event.starts_at, "HH:mm")}–${fmt(event.ends_at, "HH:mm")}`;
}

/**
 * Klassificerar ett jobbpass som natt- eller kvällspass utifrån tiderna.
 * Natt: startar 21:00 eller senare och slutar nästa dygn.
 * Kväll: startar 13:00–20:59 och slutar samma dygn.
 */
export function shiftType(event: EventRow): ShiftType | null {
  if (event.category !== "jobb" || event.all_day) return null;
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const crossesMidnight = !isSameDay(start, end);
  if (startHour >= 21 && crossesMidnight) return "natt";
  if (startHour >= 13 && startHour < 21 && !crossesMidnight) return "kvall";
  return null;
}

/** Stil för en händelse: passtyp om jobbpass, annars kategorifärg. */
export function shiftMeta(event: EventRow) {
  const type = shiftType(event);
  if (type) return { ...SHIFT_STYLES[type], shift: type };
  return { ...categoryMeta(event.category), shift: null as ShiftType | null };
}


export function weekDays(reference: Date) {
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(reference: Date) {
  const start = startOfWeek(startOfMonth(reference), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(reference), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function eventsOnDay(events: EventRow[], day: Date) {
  return events
    .filter((e) => {
      const start = new Date(e.starts_at);
      const end = new Date(e.ends_at);
      return start <= endOfDay(day) && end >= startOfDay(day);
    })
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
}

/**
 * Slår ihop dubbletter: samma tidsintervall och liknande titel från olika
 * kalendrar visas bara en gång.
 */
export function mergeDuplicates(events: EventRow[]): EventRow[] {
  const normalize = (t: string) =>
    t
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9åäö ]/gi, "");
  const synonyms: Record<string, string> = { arbete: "jobb", work: "jobb", job: "jobb" };
  const key = (e: EventRow) => {
    const title = normalize(e.title);
    const canonical = synonyms[title] ?? title;
    return `${canonical}|${new Date(e.starts_at).getTime()}|${new Date(e.ends_at).getTime()}`;
  };
  const seen = new Map<string, EventRow>();
  for (const e of events) {
    const k = key(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}

export type DayLoad = "ledig" | "delvis" | "full";

export function dayLoad(events: EventRow[], day: Date): DayLoad {
  const items = eventsOnDay(events, day);
  if (items.length === 0) return "ledig";
  const busyMinutes = items.reduce((sum, e) => {
    if (e.all_day) return sum + 480;
    const start = new Date(Math.max(+new Date(e.starts_at), +startOfDay(day)));
    const end = new Date(Math.min(+new Date(e.ends_at), +endOfDay(day)));
    return sum + Math.max(0, differenceInMinutes(end, start));
  }, 0);
  if (busyMinutes >= 480) return "full";
  return "delvis";
}

export const LOAD_STYLES: Record<DayLoad, { label: string; dot: string; text: string }> = {
  ledig: { label: "Ledig", dot: "bg-cat-ledig", text: "text-cat-ledig" },
  delvis: { label: "Delvis upptagen", dot: "bg-cat-barn", text: "text-cat-barn" },
  full: { label: "Fullbokad", dot: "bg-cat-viktigt", text: "text-cat-viktigt" },
};

/** Hittar luckor mellan händelser under en dag (mellan 06:00 och 23:00). */
export function freeGaps(events: EventRow[], day: Date, minMinutes = 30) {
  const items = eventsOnDay(events, day).filter((e) => !e.all_day);
  const dayStart = new Date(day);
  dayStart.setHours(6, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 0, 0, 0);

  const gaps: { start: Date; end: Date; minutes: number }[] = [];
  let cursor = dayStart;
  for (const e of items) {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);
    if (start > cursor) {
      const minutes = differenceInMinutes(start, cursor);
      if (minutes >= minMinutes) gaps.push({ start: cursor, end: start, minutes });
    }
    if (end > cursor) cursor = end;
  }
  if (dayEnd > cursor) {
    const minutes = differenceInMinutes(dayEnd, cursor);
    if (minutes >= minMinutes) gaps.push({ start: cursor, end: dayEnd, minutes });
  }
  return gaps;
}

export function totalHours(events: EventRow[], predicate: (e: EventRow) => boolean) {
  return (
    events
      .filter(predicate)
      .reduce(
        (sum, e) => sum + differenceInMinutes(new Date(e.ends_at), new Date(e.starts_at)),
        0,
      ) / 60
  );
}

/** Returnerar par av händelser som krockar tidsmässigt under en viss dag. */
export function overlapsOnDay(events: EventRow[], day: Date) {
  const items = eventsOnDay(events, day).filter((e) => !e.all_day);
  const pairs: [EventRow, EventRow][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      const aStart = new Date(a.starts_at).getTime();
      const aEnd = new Date(a.ends_at).getTime();
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = new Date(b.ends_at).getTime();
      if (aStart < bEnd && bStart < aEnd) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** Hittar första luckan på minst `durationMinutes` inom `days` dagar framåt. */
export function findFreeSlot(
  events: EventRow[],
  durationMinutes: number,
  reference: Date,
  days = 14,
) {
  for (let i = 0; i < days; i++) {
    const day = addDays(reference, i);
    const gaps = freeGaps(events, day, durationMinutes);
    for (const gap of gaps) {
      if (gap.minutes >= durationMinutes) {
        return { start: gap.start, end: new Date(gap.start.getTime() + durationMinutes * 60000) };
      }
    }
  }
  return null;
}

/** Föreslår kategori utifrån en händelsetitel. */
export function suggestCategory(title: string): EventRow["category"] {
  const t = title.toLowerCase();
  if (/\b(jobb|arbete|work|kontor|möte.*klient|företag|uppdra)\b/.test(t)) return "jobb";
  if (/\b(jurist|domstol|förhandling|möte.*klient|rättegång|advokat|tidsfrist)\b/.test(t))
    return "jurist";
  if (/\b(benjamin|barn|fotboll|träning|skola|lov|läkar|föräldr|hämta|lämna)\b/.test(t))
    return "barn";
  if (/\b(ledig|semester|resor|resa|friskvård|träna|gym|löp|vila)\b/.test(t)) return "ledig";
  if (/\b(viktigt|deadline|inlämning|prov|examen|bröllop|begrav)\b/.test(t)) return "viktigt";
  return "privat";
}

export { addDays, isSameDay, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth };

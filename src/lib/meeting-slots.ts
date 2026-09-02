/**
 * Räknar fram förslag på mötestider utifrån kalendern. Rena beräkningar –
 * går att använda både i gränssnittet och på servern.
 */
import { addDays, freeGaps } from "@/lib/calendar";
import type { EventRow } from "@/lib/categories";

export type MeetingSlot = { start: Date; end: Date };

export type SlotOptions = {
  durationMinutes?: number;
  count?: number;
  from?: Date;
  days?: number;
  /** Tidigaste starttid (timme) och senaste sluttid (timme). */
  startHour?: number;
  endHour?: number;
  /** Hoppa över lördag och söndag. */
  weekdaysOnly?: boolean;
  /** Marginal före och efter befintliga händelser, i minuter. */
  bufferMinutes?: number;
};

function roundUpToHalfHour(date: Date) {
  const out = new Date(date);
  out.setSeconds(0, 0);
  const rest = out.getMinutes() % 30;
  if (rest) out.setMinutes(out.getMinutes() + (30 - rest));
  return out;
}

/** Ger upp till `count` lediga tider som inte krockar med något i kalendern. */
export function suggestMeetingSlots(events: EventRow[], opts: SlotOptions = {}): MeetingSlot[] {
  const duration = opts.durationMinutes ?? 60;
  const count = opts.count ?? 3;
  const days = opts.days ?? 14;
  const startHour = opts.startHour ?? 8;
  const endHour = opts.endHour ?? 18;
  const buffer = opts.bufferMinutes ?? 15;
  const weekdaysOnly = opts.weekdaysOnly ?? true;
  const from = opts.from ?? new Date();
  const earliest = roundUpToHalfHour(new Date(from.getTime() + 60 * 60000));

  const slots: MeetingSlot[] = [];
  for (let i = 0; i < days && slots.length < count; i++) {
    const day = addDays(from, i);
    const weekday = day.getDay();
    if (weekdaysOnly && (weekday === 0 || weekday === 6)) continue;

    const gaps = freeGaps(events, day, 15);
    for (const gap of gaps) {
      const windowStart = new Date(day);
      windowStart.setHours(startHour, 0, 0, 0);
      const windowEnd = new Date(day);
      windowEnd.setHours(endHour, 0, 0, 0);

      let start = new Date(Math.max(gap.start.getTime() + buffer * 60000, windowStart.getTime()));
      if (start < earliest) start = new Date(earliest);
      start = roundUpToHalfHour(start);
      const limit = new Date(Math.min(gap.end.getTime() - buffer * 60000, windowEnd.getTime()));

      while (
        slots.length < count &&
        start.getTime() + duration * 60000 <= limit.getTime()
      ) {
        slots.push({ start: new Date(start), end: new Date(start.getTime() + duration * 60000) });
        // Nästa förslag samma dag läggs efter mötet, för spridning.
        start = new Date(start.getTime() + (duration + 60) * 60000);
        // Bara ett förslag per dag när vi vill sprida ut tiderna.
        break;
      }
      if (slots.length >= count) break;
    }
  }
  return slots;
}

const WEEKDAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
];

function two(n: number) {
  return String(n).padStart(2, "0");
}

/** "torsdag 4 september 10:00–11:00" */
export function slotLabel(slot: MeetingSlot) {
  const d = slot.start;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${two(d.getHours())}:${two(
    d.getMinutes(),
  )}–${two(slot.end.getHours())}:${two(slot.end.getMinutes())}`;
}

/** Färdig text att klistra in i ett mejlsvar. */
export function slotsAsText(slots: MeetingSlot[]) {
  if (!slots.length) return "Jag hittar tyvärr ingen ledig tid den närmaste tiden.";
  return ["Följande tider fungerar för mig:", ...slots.map((s) => `• ${slotLabel(s)}`)].join("\n");
}

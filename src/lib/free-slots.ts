import type { EventRow } from "./categories";
import { dayKey, parseLocal, timeLocal, weekdayLocal } from "./tz";

export type FreeSlot = {
  start: Date;
  end: Date;
  minutes: number;
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const MIN_SLOT_MIN = 20;

/** Luckor i kalendern de kommande dagarna, mellan 07:00 och 22:00 svensk tid. */
export function findFreeSlots(events: EventRow[], days = 7, from = new Date()): FreeSlot[] {
  const slots: FreeSlot[] = [];

  for (let i = 0; i < days; i++) {
    const cursor = new Date(from.getTime() + i * 24 * 3600 * 1000);
    const key = dayKey(cursor);
    const dayStart = parseLocal(`${key}T${String(DAY_START_HOUR).padStart(2, "0")}:00:00`);
    const dayEnd = parseLocal(`${key}T${String(DAY_END_HOUR).padStart(2, "0")}:00:00`);

    let open = Math.max(dayStart.getTime(), from.getTime());
    if (open >= dayEnd.getTime()) continue;

    const busy = events
      .filter((e) => {
        const s = new Date(e.starts_at).getTime();
        const en = new Date(e.ends_at).getTime();
        return en > dayStart.getTime() && s < dayEnd.getTime();
      })
      .map((e) => {
        if (e.all_day) return { start: dayStart.getTime(), end: dayEnd.getTime() };
        return { start: new Date(e.starts_at).getTime(), end: new Date(e.ends_at).getTime() };
      })
      .sort((a, b) => a.start - b.start);

    for (const b of busy) {
      if (b.start > open) {
        pushSlot(slots, open, Math.min(b.start, dayEnd.getTime()));
      }
      open = Math.max(open, b.end);
      if (open >= dayEnd.getTime()) break;
    }
    if (open < dayEnd.getTime()) pushSlot(slots, open, dayEnd.getTime());
  }

  return slots;
}

function pushSlot(slots: FreeSlot[], startMs: number, endMs: number) {
  const minutes = Math.round((endMs - startMs) / 60000);
  if (minutes < MIN_SLOT_MIN) return;
  slots.push({ start: new Date(startMs), end: new Date(endMs), minutes });
}

export function slotLabel(slot: FreeSlot): string {
  return `${weekdayLocal(slot.start)} ${timeLocal(slot.start)}–${timeLocal(slot.end)}`;
}

/** Kompakt textunderlag till Andrea. */
export function describeSlots(slots: FreeSlot[], max = 24): string {
  return slots
    .slice(0, max)
    .map((s) => `${slotLabel(s)} (${s.minutes} min ledigt)`)
    .join("\n");
}

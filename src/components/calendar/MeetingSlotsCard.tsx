import { useMemo, useState } from "react";
import { CalendarClock, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertRow } from "@/lib/db";
import { suggestCategory } from "@/lib/calendar";
import { slotLabel, slotsAsText, suggestMeetingSlots } from "@/lib/meeting-slots";
import type { EventRow } from "@/lib/categories";

/** Föreslår lediga mötestider utifrån kalendern. */
export function MeetingSlotsCard({ events }: { events: EventRow[] }) {
  const [minutes, setMinutes] = useState("60");
  const [title, setTitle] = useState("");
  const save = useUpsertRow("events", "Mötet är inlagt");

  const slots = useMemo(
    () => suggestMeetingSlots(events, { durationMinutes: Number(minutes), count: 3 }),
    [events, minutes],
  );

  function book(start: Date, end: Date) {
    const name = title.trim() || "Möte";
    save.mutate({
      title: name,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      category: suggestCategory(name),
      description: "Föreslagen tid från Andrea.",
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(slotsAsText(slots));
      toast.success("Tiderna är kopierade.");
    } catch {
      toast.error("Kunde inte kopiera.");
    }
  }

  return (
    <SectionCard
      title="Föreslagna tider"
      icon={CalendarClock}
      accent="text-cat-jobb"
      tint="bg-cat-jobb/12"
      action={
        <Button size="sm" variant="ghost" onClick={copy} disabled={!slots.length}>
          <Copy className="mr-1 size-4" /> Kopiera text
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Select value={minutes} onValueChange={setMinutes}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 min</SelectItem>
            <SelectItem value="60">1 timme</SelectItem>
            <SelectItem value="90">1,5 timme</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-48 flex-1"
          placeholder="Rubrik, t.ex. Möte med Anna"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {slots.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Ingen ledig tid hittades de närmaste två veckorna.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.start.toISOString()}
              className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2"
            >
              <span className="text-sm capitalize">{slotLabel(slot)}</span>
              <Button size="sm" onClick={() => book(slot.start, slot.end)} disabled={save.isPending}>
                <Plus className="mr-1 size-4" /> Boka
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

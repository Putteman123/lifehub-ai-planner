import type { Tables } from "@/integrations/supabase/types";

export type EventRow = Tables<"events">;
export type CalendarRow = Tables<"calendars">;
export type ChildRow = Tables<"children">;
export type CaseRow = Tables<"legal_cases">;
export type CaseTaskRow = Tables<"case_tasks">;
export type ReminderRow = Tables<"reminders">;

export type Category = EventRow["category"];

export const CATEGORIES: {
  value: Category;
  label: string;
  dot: string;
  chip: string;
  bar: string;
}[] = [
  {
    value: "jobb",
    label: "Heltidsjobb",
    dot: "bg-cat-jobb",
    chip: "bg-cat-jobb/12 text-cat-jobb",
    bar: "border-l-cat-jobb",
  },
  {
    value: "ledig",
    label: "Ledig",
    dot: "bg-cat-ledig",
    chip: "bg-cat-ledig/12 text-cat-ledig",
    bar: "border-l-cat-ledig",
  },
  {
    value: "jurist",
    label: "Jurist",
    dot: "bg-cat-jurist",
    chip: "bg-cat-jurist/12 text-cat-jurist",
    bar: "border-l-cat-jurist",
  },
  {
    value: "barn",
    label: "Barn",
    dot: "bg-cat-barn",
    chip: "bg-cat-barn/15 text-cat-barn",
    bar: "border-l-cat-barn",
  },
  {
    value: "privat",
    label: "Privat",
    dot: "bg-cat-privat",
    chip: "bg-cat-privat/12 text-cat-privat",
    bar: "border-l-cat-privat",
  },
  {
    value: "viktigt",
    label: "Viktigt",
    dot: "bg-cat-viktigt",
    chip: "bg-cat-viktigt/12 text-cat-viktigt",
    bar: "border-l-cat-viktigt",
  },
];

export function categoryMeta(category: Category) {
  return CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[4]!;
}

export type ShiftType = "natt" | "kvall";

export const SHIFT_STYLES: Record<
  ShiftType,
  { label: string; dot: string; chip: string; bar: string }
> = {
  natt: {
    label: "Natt",
    dot: "bg-cat-natt",
    chip: "bg-cat-natt/12 text-cat-natt",
    bar: "border-l-cat-natt",
  },
  kvall: {
    label: "Kväll",
    dot: "bg-cat-kvall",
    chip: "bg-cat-kvall/14 text-cat-kvall",
    bar: "border-l-cat-kvall",
  },
};


export const CALENDAR_SOURCES: { value: CalendarRow["source"]; label: string }[] = [
  { value: "local", label: "Lokal kalender" },
  { value: "google", label: "Google Calendar" },
  { value: "outlook", label: "Outlook Calendar" },
  { value: "apple", label: "Apple Calendar" },
  { value: "ics", label: "ICS-länk" },
  { value: "school", label: "Skolkalender" },
  { value: "sports", label: "Träningskalender" },
  { value: "family", label: "Familjekalender" },
];

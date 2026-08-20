import type { Tables } from "@/integrations/supabase/types";

export type EventRow = Tables<"events">;
export type CalendarRow = Tables<"calendars">;
export type ChildRow = Tables<"children">;
export type CaseRow = Tables<"legal_cases">;
export type CaseTaskRow = Tables<"case_tasks">;
export type ReminderRow = Tables<"reminders">;

export type Category = EventRow["category"];
export type CustomCategoryRow = Tables<"event_categories">;

export type CategoryOption = {
  value: Category;
  label: string;
  dot: string;
  chip: string;
  bar: string;
  custom?: boolean;
};

/** Färgpaletten som både inbyggda och egna kategorier hämtar sina färger ur. */
export const CATEGORY_PALETTE: { token: string; dot: string; chip: string; bar: string }[] = [
  {
    token: "cat-jobb",
    dot: "bg-cat-jobb",
    chip: "bg-cat-jobb/12 text-cat-jobb",
    bar: "border-l-cat-jobb",
  },
  {
    token: "cat-ledig",
    dot: "bg-cat-ledig",
    chip: "bg-cat-ledig/12 text-cat-ledig",
    bar: "border-l-cat-ledig",
  },
  {
    token: "cat-jurist",
    dot: "bg-cat-jurist",
    chip: "bg-cat-jurist/12 text-cat-jurist",
    bar: "border-l-cat-jurist",
  },
  {
    token: "cat-barn",
    dot: "bg-cat-barn",
    chip: "bg-cat-barn/15 text-cat-barn",
    bar: "border-l-cat-barn",
  },
  {
    token: "cat-privat",
    dot: "bg-cat-privat",
    chip: "bg-cat-privat/12 text-cat-privat",
    bar: "border-l-cat-privat",
  },
  {
    token: "cat-viktigt",
    dot: "bg-cat-viktigt",
    chip: "bg-cat-viktigt/12 text-cat-viktigt",
    bar: "border-l-cat-viktigt",
  },
  {
    token: "cat-natt",
    dot: "bg-cat-natt",
    chip: "bg-cat-natt/12 text-cat-natt",
    bar: "border-l-cat-natt",
  },
  {
    token: "cat-kvall",
    dot: "bg-cat-kvall",
    chip: "bg-cat-kvall/14 text-cat-kvall",
    bar: "border-l-cat-kvall",
  },
  {
    token: "cat-iptv",
    dot: "bg-cat-iptv",
    chip: "bg-cat-iptv/14 text-cat-iptv",
    bar: "border-l-cat-iptv",
  },
  {
    token: "cat-ekonomi",
    dot: "bg-cat-ekonomi",
    chip: "bg-cat-ekonomi/14 text-cat-ekonomi",
    bar: "border-l-cat-ekonomi",
  },
];

export function paletteByToken(token: string) {
  return CATEGORY_PALETTE.find((p) => p.token === token) ?? CATEGORY_PALETTE[4]!;
}

/** Stabil färg för ett kategorinamn när färgen inte är känd (t.ex. i listvyer). */
export function paletteForValue(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]!;
}

/** Nästa färg i turordning när en ny egen kategori skapas. */
export function nextPaletteToken(usedCount: number) {
  return CATEGORY_PALETTE[usedCount % CATEGORY_PALETTE.length]!.token;
}

export const CATEGORIES: CategoryOption[] = [

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

/** Slår ihop inbyggda kategorier med användarens egna. */
export function mergeCategories(custom: CustomCategoryRow[] = []): CategoryOption[] {
  const extra = [...custom]
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "sv"))
    .filter((row) => !CATEGORIES.some((c) => c.value === row.value))
    .map((row) => {
      const palette = paletteByToken(row.color_token);
      return {
        value: row.value,
        label: row.label,
        dot: palette.dot,
        chip: palette.chip,
        bar: palette.bar,
        custom: true,
      } satisfies CategoryOption;
    });
  return [...CATEGORIES, ...extra];
}

/** Stil och etikett för en kategori, även egna som inte finns i listan. */
export function categoryMeta(category: Category, options?: CategoryOption[]): CategoryOption {
  const found = (options ?? CATEGORIES).find((c) => c.value === category);
  if (found) return found;
  const palette = paletteForValue(String(category ?? "privat"));
  return {
    value: category,
    label: String(category ?? "Privat"),
    dot: palette.dot,
    chip: palette.chip,
    bar: palette.bar,
    custom: true,
  };
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

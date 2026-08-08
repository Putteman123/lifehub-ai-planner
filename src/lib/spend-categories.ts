import type { SpendRow } from "@/lib/finance";

/** Grundkategorier som alltid finns med i väljaren. */
export const DEFAULT_SPEND_CATEGORIES = [
  "Dagligvaror",
  "Restaurang",
  "Transport",
  "Boende",
  "Hälsa",
  "Barn",
  "Nöje",
  "Kläder",
  "Prenumerationer",
  "Övrigt",
];

/** Kategorier användaren redan använt, mest använda först, plus grundkategorierna. */
export function spendCategories(spends: SpendRow[]) {
  const counts = new Map<string, number>();
  for (const row of spends) {
    const name = (row.category ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const seen = new Set(used.map((name) => name.toLowerCase()));
  return [...used, ...DEFAULT_SPEND_CATEGORIES.filter((name) => !seen.has(name.toLowerCase()))];
}

/** Gissar kategori för en ny utgift utifrån tidigare anteckningar. */
export function guessCategory(note: string, spends: SpendRow[]) {
  const key = note.trim().toLowerCase();
  if (!key) return null;
  const hit = spends.find(
    (row) => row.category && (row.note ?? "").trim().toLowerCase() === key,
  );
  return hit?.category ?? null;
}

import type { SpendRow } from "@/lib/finance";

/** Grundkategorier som alltid finns med i väljaren. */
export const DEFAULT_SPEND_CATEGORIES = [
  "Dagligvaror",
  "Cigaretter",
  "Snus",
  "Spel",
  "Utlägg juridik",
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

/** Kategorier som tillsammans utgör tobak. */
export const TOBACCO_CATEGORIES = ["Cigaretter", "Snus"];

/** Kategorin cigaretter, snus eller null – utifrån ett varunamn. */
export function tobaccoCategory(name: string): "Cigaretter" | "Snus" | null {
  const key = name.toLowerCase();
  const snus =
    /\b(snus|portion|prilla|general|ettan|gr[oö]v|catch|lyft|zyn|velo|siberia|skruf|kaliber|nicotine pouch|nikotinp[aå]s)/;
  const cigs =
    /\b(cigarett|cigaretter|marlboro|l&m|lucky strike|camel|prince|blend|chesterfield|winston|pall mall|john silver|r[oö]ktobak|cigarr|tobak)/;
  if (snus.test(key)) return "Snus";
  if (cigs.test(key)) return "Cigaretter";
  return null;
}


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

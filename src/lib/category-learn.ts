/**
 * Lokal inlärning av kategorier: när du rättar Andreas förslag sparas
 * nyckelorden så att samma sorts post hamnar rätt nästa gång.
 */

const KEY = "lifehub.category-rules.v1";

type Rules = Record<string, string>;

const STOP_WORDS = new Set([
  "och",
  "att",
  "med",
  "för",
  "till",
  "från",
  "den",
  "det",
  "min",
  "mitt",
  "hos",
  "på",
  "en",
  "ett",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9åäö]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

function read(): Rules {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Rules;
  } catch {
    return {};
  }
}

function write(rules: Rules) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {
    // fullt lagringsutrymme – strunt samma
  }
}

/** Sparar en rättelse så att kategorin sitter nästa gång. */
export function learnCategory(title: string, category: string) {
  const rules = read();
  for (const word of words(title)) rules[word] = category;
  write(rules);
}

/** Hittar en tidigare inlärd kategori för texten, annars null. */
export function learnedCategory(title: string): string | null {
  const rules = read();
  for (const word of words(title)) {
    const hit = rules[word];
    if (hit) return hit;
  }
  return null;
}

/** Antal inlärda regler – visas i inställningarna. */
export function learnedRuleCount() {
  return Object.keys(read()).length;
}

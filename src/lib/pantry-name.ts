/**
 * Normalisering av varunamn så att samma vara känns igen även när Andrea
 * läser av den olika från kvitto till kvitto ("Iste", "Iste citron/lime").
 */

/** Smaksättningar och beskrivningar som inte gör varan till en annan vara. */
const FLAVORS = [
  "citron",
  "lime",
  "apelsin",
  "päron",
  "hallon",
  "jordgubb",
  "jordgubbar",
  "blåbär",
  "mango",
  "persika",
  "ananas",
  "vanilj",
  "choklad",
  "kanel",
  "original",
  "naturell",
  "mild",
  "stark",
  "lätt",
  "eko",
  "ekologisk",
  "ekologiska",
  "fryst",
  "frysta",
  "färsk",
  "färska",
  "svensk",
  "svenska",
  "röd",
  "gul",
  "grön",
  "stor",
  "liten",
];

/** Varugrupper där alla varianter ska räknas som samma vara. */
const SYNONYMS: { re: RegExp; key: string }[] = [
  { re: /nugget/, key: "nugget" },
  { re: /(^|\s)iste|ice\s?tea|icetea/, key: "iste" },
  { re: /mellanmjölk|standardmjölk|lättmjölk|(^|\s)mjölk/, key: "mjölk" },
  { re: /köttbull/, key: "köttbullar" },
  { re: /äppel\s?juice|äppeljuice|äpplejuice/, key: "äppeljuice" },
  { re: /apelsinjuice|apelsin\s?juice/, key: "apelsinjuice" },
  { re: /schnitzel/, key: "schnitzel" },
  { re: /müsli|musli|granola/, key: "müsli" },
  { re: /kyckling(filé|filet|bröst)/, key: "kycklingfilé" },
  { re: /toalettpapper|hushållspapper/, key: "papper" },
];

/** Poster som inte är matvaror och därför inte hör hemma i skafferiet. */
const NON_GROCERY =
  /^(plastkasse|papperskasse|bärkasse|kasse|påse|pant|pantretur|pantflaska|avrundning|rabatt|bonus|totalt|summa)$/;

function stripUnits(text: string) {
  return text
    .replace(/\b\d+([.,]\d+)?\s?(kg|g|hg|l|dl|cl|ml|st|pack|p|x)\b/g, " ")
    .replace(/\b\d+([.,]\d+)?\b/g, " ");
}

function singular(word: string) {
  if (word.length <= 5) return word;
  for (const suffix of ["arna", "erna", "orna", "ar", "er", "or", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

/**
 * Kanonisk nyckel för en vara: gemener, utan smaksättning, förpackning,
 * pluralformer och mellanslag. Används för att slå ihop varianter.
 */
export function canonicalKey(name: string): string {
  let text = name.toLowerCase().trim();
  text = text.split(/[/(]/)[0]!;
  text = text.split(" & ")[0]!;
  text = stripUnits(text);
  text = text.replace(/[^\wåäöéü\s-]+/g, " ").replace(/\s+/g, " ").trim();

  for (const rule of SYNONYMS) {
    if (rule.re.test(text)) return rule.key;
  }

  let words = text.split(" ").filter(Boolean);
  while (words.length > 1 && FLAVORS.includes(words[words.length - 1]!)) {
    words = words.slice(0, -1);
  }
  while (words.length > 1 && FLAVORS.includes(words[0]!)) {
    words = words.slice(1);
  }

  const key = words.map(singular).join("");
  return key || text.replace(/\s+/g, "");
}

/** True om raden inte är en matvara (kassar, pant, rabatter). */
export function isNonGrocery(name: string) {
  const clean = name.toLowerCase().trim().replace(/\s+/g, " ");
  return NON_GROCERY.test(clean);
}

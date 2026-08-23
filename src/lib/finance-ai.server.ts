import { ANDREA_QUICK_MODEL, ANDREA_FAST_MODEL } from "@/lib/ai-models";
import { tobaccoCategory } from "@/lib/spend-categories";

export type ReceiptRead = {
  merchant: string | null;
  address: string | null;
  total: number | null;
  date: string | null;
  time: string | null;
  category: string | null;
  kind: "kvitto" | "faktura" | "annat";
  /** Betalsättet på kvittot, t.ex. "Kort", "Kontant", "Swish". */
  payment: string | null;
  groceries: { name: string; quantity: string | null; amount: number | null }[];
  /** Tobak (cigaretter/snus) hålls skilt från mat och hamnar inte i skafferiet. */
  tobacco: {
    name: string;
    category: "Cigaretter" | "Snus";
    amount: number | null;
    quantity: string | null;
  }[];
  /** Rabatter och inlösta kuponger (positiva belopp som dras av). */
  discounts: { name: string; amount: number | null }[];
  /** Icke-matvaror på kvittot (kasse, pant, avrundning) – räknas in i balansen men inte i skafferiet. */
  other: { name: string; amount: number | null }[];
  /**
   * Stämmer varor + tobak − rabatter mot totalen (inom 2 kr)?
   * null när totalen saknas eller kvittot saknar varurader.
   */
  balanced: boolean | null;
  /** Differensen mellan radsumma och total (positiv = raderna är högre). */
  diff: number | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    merchant: { type: "string" },
    address: { type: "string" },
    total: { type: "number" },
    date: { type: "string" },
    time: { type: "string" },
    category: { type: "string" },
    kind: { type: "string", enum: ["kvitto", "faktura", "annat"] },
    payment: { type: "string" },
    groceries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          amount: { type: "number" },
          is_campaign: { type: "boolean" },
        },
        required: ["name", "quantity", "amount", "is_campaign"],
      },
    },
    tobacco: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: ["Cigaretter", "Snus"] },
          amount: { type: "number" },
          quantity: { type: "string" },
        },
        required: ["name", "category", "amount", "quantity"],
      },
    },
    discounts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
        },
        required: ["name", "amount"],
      },
    },
    other: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
        },
        required: ["name", "amount"],
      },
    },
  },
  required: [
    "merchant",
    "address",
    "total",
    "date",
    "time",
    "category",
    "kind",
    "payment",
    "groceries",
    "tobacco",
    "discounts",
    "other",
  ],
} as const;


/**
 * Läser av ett kvitto eller en faktura från en bild eller PDF och plockar ut
 * belopp, datum, kategori samt dagligvaror som kan hamna på inköpslistan.
 */
export async function readReceipt(opts: {
  apiKey: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  knownCategories: string[];
}): Promise<ReceiptRead> {
  const isPdf = opts.mimeType === "application/pdf";
  const content = [
    {
      type: "text",
      text:
        `Läs av detta kvitto/faktura. Använd i första hand någon av användarens befintliga kategorier: ${
          opts.knownCategories.join(", ") || "inga ännu"
        }. Skapa bara en ny kategori om ingen passar. Datum i formatet YYYY-MM-DD. time = klockslaget på kvittot i formatet HH:MM, tom sträng om det saknas. address = butikens fullständiga postadress med gata, postnummer och ort (tom sträng om den saknas) – använd den fullständiga adressen i kvittots sidfot om både en kort sidhuvudsadress och en fullständig adress finns. total = totalbeloppet att betala i kronor som ett tal. payment = betalsättet (Kort, Kontant, Swish), tom sträng om det saknas.

Varurader:
- groceries = alla varurader utom tobak, med korta svenska varunamn i singular utan smaksättning i namnet ("Iste" inte "Iste citron/lime").
- Antalsrader: "Vetefralla 3,50 x 4   14,00" betyder quantity "4 st" och amount 14,00 – amount är ALLTID radens totalpris, aldrig styckpriset.
- quantity kan vara tom sträng, amount = radens pris i kronor (0 om priset saknas).
- Om två rader annars skulle få samma namn, behåll ett särskiljande ord ("Salami fänkål" och "Salami napoli", inte två "Salami").
- Läs ALDRIG in marknadsföring, tävlingstexter eller kupongavsnitt (t.ex. "Inlösta kuponger", "Tävla om fina vinster") som varor – de är inte köp.

Övrigt: kassar, påsar, pant, pantreturer och öresavrundning läggs i other med namn och amount (radens totalpris). De ska varken ligga i groceries eller tobacco.

Tobak: får ALDRIG ligga i groceries. Cigaretter, cigarrer, röktobak, snus och nikotinpåsar läggs i tobacco med category "Cigaretter" eller "Snus", amount = radens totalpris (0 om det saknas) och quantity som antal vid antalsrader ("MARLBORO Gold TW2 89,00 x 2" → amount 178,00, quantity "2 st"). Känn igen tobak på märkesnamn även utan ordet cigaretter/snus: Marlboro, L&M, Camel, Prince, Blend, Chesterfield, Winston, Pall Mall, Lucky Strike, John Silver, General, Ettan, Grov, Catch, Lyft, ZYN, Velo, Siberia, Skruf, Kaliber.

Rabatter: varje rabatt- eller kupongrad (t.ex. "Lidl Plus-rabatt -10,00", "Bonusrabatt -8,90") läggs i discounts med amount som POSITIVT tal (det belopp som dras av). Rabattrader får aldrig ligga i groceries.

Är det en faktura eller ett dokument utan varor ska groceries, tobacco, discounts och other vara tomma.`,
    },
    isPdf
      ? {
          type: "file",
          file: { filename: opts.fileName, file_data: opts.dataUrl },
        }
      : { type: "image_url", image_url: { url: opts.dataUrl } },
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: ANDREA_QUICK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du är Andrea, en svensk assistent som tolkar kvitton och fakturor. Svara enbart med JSON enligt schemat.",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "receipt", strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("För många AI-förfrågningar, försök snart igen.");
    if (res.status === 402) throw new Error("AI-krediterna är slut.");
    throw new Error(`Andrea kunde inte läsa kvittot (${res.status}).`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = (json.choices?.[0]?.message?.content ?? "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: Partial<ReceiptRead> & {
    groceries?: { name?: string; quantity?: string; amount?: number }[];
    tobacco?: { name?: string; category?: string; amount?: number; quantity?: string }[];
    discounts?: { name?: string; amount?: number }[];
    other?: { name?: string; amount?: number }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Andrea kunde inte tolka kvittot. Prova en tydligare bild.");
  }

  const total = Number(parsed.total);
  const { isNonGrocery } = await import("./pantry-name");

  const groceries = (parsed.groceries ?? [])
    .map((item) => {
      const amount = Number(item.amount);
      return {
        name: String(item.name ?? "").trim(),
        quantity: item.quantity?.trim() ? item.quantity.trim() : null,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      };
    })
    .filter(
      (item) => item.name.length > 0 && !tobaccoCategory(item.name) && !isNonGrocery(item.name),
    )
    .slice(0, 40);

  const tobacco = (parsed.tobacco ?? [])
    .map((item) => {
      const name = String(item.name ?? "").trim();
      const amount = Number(item.amount);
      return {
        name,
        category: (item.category === "Snus"
          ? "Snus"
          : item.category === "Cigaretter"
            ? "Cigaretter"
            : (tobaccoCategory(name) ?? "Cigaretter")) as "Cigaretter" | "Snus",
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        quantity: item.quantity?.trim() ? item.quantity.trim() : null,
      };
    })
    .filter((item) => item.name.length > 0)
    .slice(0, 20);

  const discounts = (parsed.discounts ?? [])
    .map((item) => {
      const amount = Math.abs(Number(item.amount));
      return {
        name: String(item.name ?? "").trim(),
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      };
    })
    .filter((item) => item.name.length > 0)
    .slice(0, 20);

  const other = (parsed.other ?? [])
    .map((item) => {
      const amount = Math.abs(Number(item.amount));
      return {
        name: String(item.name ?? "").trim(),
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      };
    })
    .filter((item) => item.name.length > 0 && !tobaccoCategory(item.name))
    .slice(0, 20);

  // Kontrollräkning: varor + tobak + övrigt − rabatter ska matcha totalen.
  const totalValue = Number.isFinite(total) && total > 0 ? total : null;
  const rowCount = groceries.length + tobacco.length + other.length;
  let balanced: boolean | null = null;
  let diff: number | null = null;
  if (totalValue !== null && rowCount > 0) {
    const sum =
      groceries.reduce((acc, item) => acc + (item.amount ?? 0), 0) +
      tobacco.reduce((acc, item) => acc + (item.amount ?? 0), 0) +
      other.reduce((acc, item) => acc + (item.amount ?? 0), 0) -
      discounts.reduce((acc, item) => acc + (item.amount ?? 0), 0);
    diff = Math.round((sum - totalValue) * 100) / 100;
    balanced = Math.abs(diff) <= 2;
  }

  return {
    merchant: parsed.merchant?.trim() || null,
    address: parsed.address?.trim() || null,
    total: totalValue,
    date: parsed.date?.slice(0, 10) || null,
    time: /^\d{1,2}:\d{2}$/.test(parsed.time?.trim() ?? "") ? parsed.time!.trim() : null,
    category: parsed.category?.trim() || null,
    kind: parsed.kind === "faktura" || parsed.kind === "annat" ? parsed.kind : "kvitto",
    payment: parsed.payment?.trim() || null,
    groceries,
    tobacco,
    discounts,
    other,
    balanced,
    diff,
  };
}

export type BetSlipRead = {
  date: string | null;
  track: string | null;
  gameType: string | null;
  rows: number | null;
  stake: number | null;
};

const BET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    track: { type: "string" },
    gameType: { type: "string" },
    rows: { type: "number" },
    stake: { type: "number" },
  },
  required: ["date", "track", "gameType", "rows", "stake"],
} as const;

/** Läser av en spelkupong (ATG/trav) och plockar ut datum, bana, spelform, rader och insats. */
export async function readBetSlip(opts: {
  apiKey: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
}): Promise<BetSlipRead> {
  const isPdf = opts.mimeType === "application/pdf";
  const content = [
    {
      type: "text",
      text:
        'Läs av denna spelkupong (ATG, trav eller galopp). date = speldatum i formatet YYYY-MM-DD (tom sträng om det saknas). track = banans namn, t.ex. Solvalla (tom sträng om det saknas). gameType = spelformen, t.ex. V75, V86, V64, V4, Dagens Dubbel, Trio, Vinnare eller Plats. rows = antal rader/kombinationer som ett tal, 1 om det inte framgår. stake = total insats i kronor som ett tal.',
    },
    isPdf
      ? { type: "file", file: { filename: opts.fileName, file_data: opts.dataUrl } }
      : { type: "image_url", image_url: { url: opts.dataUrl } },
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: ANDREA_FAST_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du är Andrea, en svensk assistent som tolkar spelkuponger. Svara enbart med JSON enligt schemat.",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "betslip", strict: true, schema: BET_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("För många AI-förfrågningar, försök snart igen.");
    if (res.status === 402) throw new Error("AI-krediterna är slut.");
    throw new Error(`Andrea kunde inte läsa kupongen (${res.status}).`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: Partial<Record<keyof BetSlipRead, unknown>>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Andrea kunde inte tolka kupongen. Prova en tydligare bild.");
  }

  const stake = Number(parsed.stake);
  const rows = Number(parsed.rows);
  const date = String(parsed.date ?? "").slice(0, 10);
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    track: String(parsed.track ?? "").trim() || null,
    gameType: String(parsed.gameType ?? "").trim() || null,
    rows: Number.isFinite(rows) && rows > 0 ? Math.round(rows) : null,
    stake: Number.isFinite(stake) && stake > 0 ? stake : null,
  };
}

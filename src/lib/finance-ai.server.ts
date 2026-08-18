import { ANDREA_FAST_MODEL } from "@/lib/ai-models";
import { tobaccoCategory } from "@/lib/spend-categories";

export type ReceiptRead = {
  merchant: string | null;
  address: string | null;
  total: number | null;
  date: string | null;
  time: string | null;
  category: string | null;
  kind: "kvitto" | "faktura" | "annat";
  groceries: { name: string; quantity: string | null; amount: number | null }[];
  /** Tobak (cigaretter/snus) hålls skilt från mat och hamnar inte i skafferiet. */
  tobacco: { name: string; category: "Cigaretter" | "Snus"; amount: number | null }[];
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
    groceries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
        },
        required: ["name", "quantity"],
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
        },
        required: ["name", "category", "amount"],
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
    "groceries",
    "tobacco",
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
        }. Skapa bara en ny kategori om ingen passar. Datum i formatet YYYY-MM-DD. time = klockslaget på kvittot i formatet HH:MM, tom sträng om det saknas. address = butikens fullständiga gatuadress med ort precis som den står på kvittot (tom sträng om den saknas). total = totalbeloppet i kronor som ett tal. groceries = endast dagligvaror (mat, dryck, hushåll) med korta svenska varunamn i singular, quantity kan vara tom sträng. Tobak får ALDRIG ligga i groceries: cigaretter, cigarrer, röktobak, snus och nikotinpåsar läggs i stället i tobacco med category "Cigaretter" eller "Snus" och amount = radens pris i kronor (0 om priset saknas). Är det en faktura eller ett dokument utan varor ska groceries vara tom.`,
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
      model: ANDREA_FAST_MODEL,
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
    groceries?: { name?: string; quantity?: string }[];
    tobacco?: { name?: string; category?: string; amount?: number }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Andrea kunde inte tolka kvittot. Prova en tydligare bild.");
  }

  const total = Number(parsed.total);
  return {
    merchant: parsed.merchant?.trim() || null,
    address: parsed.address?.trim() || null,
    total: Number.isFinite(total) && total > 0 ? total : null,
    date: parsed.date?.slice(0, 10) || null,
    time: /^\d{1,2}:\d{2}$/.test(parsed.time?.trim() ?? "") ? parsed.time!.trim() : null,
    category: parsed.category?.trim() || null,
    kind: parsed.kind === "faktura" || parsed.kind === "annat" ? parsed.kind : "kvitto",
    groceries: (parsed.groceries ?? [])
      .map((item) => ({
        name: String(item.name ?? "").trim(),
        quantity: item.quantity?.trim() ? item.quantity.trim() : null,
      }))
      .filter((item) => item.name.length > 0 && !tobaccoCategory(item.name))
      .slice(0, 40),
    tobacco: (parsed.tobacco ?? [])
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
        };
      })
      .filter((item) => item.name.length > 0)
      .slice(0, 20),
  };
}

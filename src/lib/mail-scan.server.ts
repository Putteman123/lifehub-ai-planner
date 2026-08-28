/**
 * Läser inkommande mejl och plockar ut fakturor, kortkvitton och
 * prenumerationer. Endast serverkod får importera den här filen.
 */
import { completeText } from "@/lib/ai-complete.server";

export type MailFindingKind = "faktura" | "kvitto" | "prenumeration";

export type MailScanResult = {
  kind: MailFindingKind | "inget";
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  occurred_at: string | null;
  reference: string | null;
  category: string | null;
  interval_months: number | null;
  summary: string | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["faktura", "kvitto", "prenumeration", "inget"] },
    merchant: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    due_date: { type: "string", description: "YYYY-MM-DD eller tom sträng" },
    occurred_at: { type: "string", description: "YYYY-MM-DD eller tom sträng" },
    reference: { type: "string", description: "OCR eller fakturanummer" },
    category: { type: "string" },
    interval_months: { type: "number" },
    summary: { type: "string" },
  },
  required: [
    "kind",
    "merchant",
    "amount",
    "currency",
    "due_date",
    "occurred_at",
    "reference",
    "category",
    "interval_months",
    "summary",
  ],
} as const;

const SYSTEM = [
  "Du är Andrea, en svensk ekonomiassistent som läser mejl.",
  "Avgör om mejlet handlar om pengar:",
  '- "faktura" = något som ska betalas (räkning, påminnelse, avi) med förfallodatum.',
  '- "kvitto" = redan betalt, t.ex. kortköp, orderbekräftelse med genomförd betalning.',
  '- "prenumeration" = återkommande abonnemang som dras löpande.',
  '- "inget" = nyhetsbrev, reklam, leveransinfo eller annat utan betalning.',
  "Belopp anges i siffror utan valutatecken. Datum i formatet YYYY-MM-DD.",
  "Lämna fält tomma (tom sträng eller 0) när uppgiften saknas. Gissa aldrig belopp.",
  "Kategori väljs bland: Boende, Mat, Transport, Nöje, Prenumeration, Försäkring, Hälsa, Barn, Juridik, Övrigt.",
].join("\n");

function clean(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

function numberOrNull(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num !== 0 ? num : null;
}

/** Klassificerar ett enskilt mejl. Returnerar null när det inte rör pengar. */
export async function classifyMail(input: {
  apiKey?: string;
  from: string;
  subject: string;
  date: string | null;
  body: string;
}): Promise<MailScanResult | null> {
  const raw = await completeText({
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    system: SYSTEM,
    input: [
      `Från: ${input.from}`,
      `Ämne: ${input.subject}`,
      `Mejlets datum: ${input.date ?? "okänt"}`,
      "",
      input.body.slice(0, 5000),
    ].join("\n"),
    jsonSchema: { name: "mail_finding", schema: SCHEMA as unknown as Record<string, unknown> },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const kind = clean(parsed["kind"]);
  if (!kind || kind === "inget") return null;
  if (kind !== "faktura" && kind !== "kvitto" && kind !== "prenumeration") return null;

  const amount = numberOrNull(parsed["amount"]);
  if (!amount) return null;

  return {
    kind,
    merchant: clean(parsed["merchant"]),
    amount,
    currency: clean(parsed["currency"]) ?? "SEK",
    due_date: clean(parsed["due_date"]),
    occurred_at: clean(parsed["occurred_at"]),
    reference: clean(parsed["reference"]),
    category: clean(parsed["category"]),
    interval_months: numberOrNull(parsed["interval_months"]),
    summary: clean(parsed["summary"]),
  };
}

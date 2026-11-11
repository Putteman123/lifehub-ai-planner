import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  bank: z.string().max(20),
  accounts: z.array(z.string().max(80)).max(30),
  rows: z.array(z.object({ i: z.number(), date: z.string().max(10), amount: z.number(), text: z.string().max(200) })).max(400),
  rawText: z.string().max(60000).optional(),
  image: z.object({ mimeType: z.string().regex(/^image\//), data: z.string().max(8_000_000) }).optional(),
});

export type ClassifiedRow = {
  i: number; date: string; amount: number; text: string;
  kind: "spend" | "income" | "transfer";
  category: string; other_account: string | null; confidence: number;
};

const schema = {
  name: "statement_rows",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            i: { type: "number" }, date: { type: "string" }, amount: { type: "number" }, text: { type: "string" },
            kind: { type: "string", enum: ["spend", "income", "transfer"] },
            category: { type: "string" },
            other_account: { type: ["string", "null"] },
            confidence: { type: "number" },
          },
          required: ["i", "date", "amount", "text", "kind", "category", "other_account", "confidence"],
        },
      },
    },
    required: ["items"],
  },
};

/** Låter Perplexity (Gemini) sortera kontoutdragsrader. Körs bara på knapptryck. */
export const classifyStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { completeTextDetailed } = await import("./ai-complete.server");
    const system = `Du sorterar rader från ett svenskt kontoutdrag (bank: ${data.bank}). Användarens egna konton: ${data.accounts.join(", ") || "okända"}.
För varje rad: kind = "spend" (utgift, negativt belopp), "income" (inkomst) eller "transfer" (flytt mellan användarens EGNA konton, t.ex. SEB <-> Revolut, "Top-up", "Överföring eget konto", "Insättning från SEB"). Betalningar till andra personer (Swish m.m.) är spend/income, inte transfer.
other_account = namnet på det andra egna kontot vid transfer (ur listan), annars null.
category = kort svensk kategori för utgifter (Mat, Transport, Nöje, Boende, Shopping, Hälsa, Abonnemang, Restaurang, Resor, Övrigt) eller inkomstslag (Lön, Swish, Återbetalning, Övrigt).
confidence 0–1 = hur säker du är på kind och category. Behåll i, date (YYYY-MM-DD), amount (negativt = pengar ut) och text oförändrade.${data.rawText ? " Raderna kommer som fri text från en PDF: läs ut varje transaktion själv och numrera i från 0." : ""} Svara enbart med JSON.`;
    const input = data.rawText ? data.rawText : JSON.stringify(data.rows);
    let text: string; let provider: string;
    if (data.image) {
      const { completeVision } = await import("./ai-complete.server");
      text = await completeVision({ system: system + " Raderna finns i bifogad bild (skärmdump/foto av kontoutdrag): läs ut varje transaktion själv och numrera i från 0.", input: "Läs ut alla transaktioner ur bilden.", attachments: [{ filename: "kontoutdrag", mimeType: data.image.mimeType, data: data.image.data }], jsonSchema: schema, feature: "kontoutdrag-bild" });
      provider = "lovable";
    } else {
      ({ text, provider } = await completeTextDetailed({ system, input, jsonSchema: schema, feature: "kontoutdrag" }));
    }
    const clean = text.replace(/^```(?:json)?|```$/gm, "").trim();
    let items: ClassifiedRow[];
    try { items = JSON.parse(clean).items; } catch { throw new Error("Kunde inte tolka svaret från AI:n. Försök igen."); }
    return { items: (items ?? []).filter((r) => r && typeof r.amount === "number" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)), provider };
  });

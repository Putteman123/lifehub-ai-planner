import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Läser av ett uppladdat kvitto/faktura med Andrea och returnerar tolkningen. */
export const analyzeReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32),
        mimeType: z.string().default("image/jpeg"),
        fileName: z.string().default("kvitto"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");

    const { data: rows } = await context.supabase
      .from("spend_entries")
      .select("category")
      .not("category", "is", null)
      .order("spent_at", { ascending: false })
      .limit(120);

    const knownCategories = [
      ...new Set((rows ?? []).map((row) => (row.category ?? "").trim()).filter(Boolean)),
    ].slice(0, 20);

    const { readReceipt } = await import("@/lib/finance-ai.server");
    return readReceipt({
      apiKey,
      dataUrl: data.dataUrl,
      mimeType: data.mimeType,
      fileName: data.fileName,
      knownCategories,
    });
  });

/** Kort AI-analys av utgifterna i förhållande till dagsbudgeten. */
export const financeInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ perDay: z.number(), days: z.number() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: spends }, { data: fixed }] = await Promise.all([
      context.supabase
        .from("spend_entries")
        .select("amount, category, note, spent_at")
        .gte("spent_at", since)
        .order("spent_at", { ascending: false })
        .limit(150),
      context.supabase.from("fixed_expenses").select("name, amount").eq("is_active", true),
    ]);

    const lines = (spends ?? [])
      .map(
        (row) =>
          `${row.spent_at.slice(0, 10)} ${Number(row.amount)} kr ${row.category ?? "okänt"}${
            row.note ? ` (${row.note})` : ""
          }`,
      )
      .join("\n");
    const fixedLine = (fixed ?? [])
      .map((row) => `${row.name} ${Number(row.amount)} kr`)
      .join(", ");

    const { completeText } = await import("@/lib/ai-complete.server");
    const text = await completeText({
      apiKey,
      system:
        "Du är Andrea, en varm och konkret svensk ekonomiassistent. Svara med högst tre korta punkter (max 20 ord per punkt) om utgiftsmönster och ett konkret spartips. Ingen inledning, inga rubriker.",
      input: `Dagsbudget: ${Math.round(data.perDay)} kr i ${data.days} dagar.\nFasta utgifter: ${
        fixedLine || "inga"
      }.\nUtgifter senaste 30 dagarna:\n${lines || "inga registrerade"}`,
    });

    return { text };
  });

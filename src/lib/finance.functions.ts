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

/**
 * Markerar butiken från ett kvitto som ett besök i platsloggen, så att köpet
 * syns på kartan och i "Min dag".
 */
export const logReceiptVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        merchant: z.string().trim().min(1),
        address: z.string().trim().optional(),
        spentAt: z.string().min(10),
        amount: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveAddressPoint } = await import("./maps.server");
    const query = [data.address, data.merchant].filter(Boolean).join(", ");
    const point =
      (await resolveAddressPoint(query)) ??
      (data.address ? null : await resolveAddressPoint(`${data.merchant}, Sverige`));

    if (!point) {
      return { ok: false as const, message: "Hittade ingen adress för butiken." };
    }

    const arrived = new Date(data.spentAt);
    const left = new Date(arrived.getTime() + 15 * 60_000);

    // Finns redan ett besök samma dag på samma butik? Skriv inte dubbelt.
    const dayStart = new Date(arrived);
    dayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await context.supabase
      .from("visits")
      .select("id")
      .eq("label", data.merchant)
      .gte("arrived_at", dayStart.toISOString())
      .lte("arrived_at", new Date(dayStart.getTime() + 86_400_000).toISOString())
      .limit(1);
    if (existing?.length) {
      return { ok: true as const, message: "Besöket fanns redan på kartan.", ...point };
    }

    const { data: places } = await context.supabase.from("places").select("*");
    const { matchPlace } = await import("./geo");
    const place = matchPlace(places ?? [], point.lat, point.lng);

    const { error } = await context.supabase.from("visits").insert({
      user_id: context.userId,
      place_id: place?.id ?? null,
      label: data.merchant,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      arrived_at: arrived.toISOString(),
      left_at: left.toISOString(),
      entry_kind: "besok",
      distance_m: 0,
      travel_mode: "okant",
      source: "kvitto",
      is_manual: false,
      note: data.amount ? `Köp ${Math.round(data.amount)} kr` : null,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, message: `${data.merchant} markerad på kartan.`, ...point };
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

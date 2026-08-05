import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Andrea förgyller inköpslistan med dagligvaror utifrån vad användaren
 * brukar handla (varuregistret) plus vanliga basvaror.
 */
export const suggestShoppingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ existing: z.array(z.string()).default([]) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");

    const { data: pantry } = await context.supabase
      .from("pantry_items")
      .select("name, times_added")
      .order("times_added", { ascending: false })
      .limit(40);

    const history = (pantry ?? [])
      .map((row) => `${row.name} (${row.times_added} ggr)`)
      .join(", ");

    const { completeText } = await import("@/lib/ai-complete.server");

    const raw = await completeText({
      apiKey,
      system:
        "Du är Andrea, en svensk personlig assistent. Föreslå dagligvaror till en svensk inköpslista. Utgå i första hand från användarens historik och komplettera med vanliga basvaror i ett svenskt hushåll. Använd korta svenska varunamn i singular, t.ex. Mjölk, Ägg, Smör, Kaffe. Föreslå högst 12 varor och upprepa inte varor som redan ligger i listan. Svara enbart med JSON.",
      input: `Varor som redan ligger i listan: ${data.existing.join(", ") || "inga"}.\nAnvändarens vanligaste varor: ${history || "ingen historik ännu"}.\nSvara med json.`,
      jsonSchema: {
        name: "shopping_suggestions",
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
                  name: { type: "string" },
                  category: { type: "string" },
                },
                required: ["name", "category"],
              },
            },
          },
          required: ["items"],
        },
      },
    });

    const text = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let items: { name: string; category: string | null }[] = [];
    try {
      const parsed = JSON.parse(text) as { items?: { name?: string; category?: string }[] };
      items = (parsed.items ?? [])
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          category: item.category ?? null,
        }))
        .filter((item) => item.name.length > 0);
    } catch {
      throw new Error("Andrea kunde inte tolka förslagen. Försök igen.");
    }

    return { items: items.slice(0, 12) };
  });

/**
 * Avslutar listan: arkiverar den, och lägger resultatet som en
 * påminnelse på översikten.
 */
export const completeShoppingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ listId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("shopping_items")
      .select("id, name, is_checked")
      .eq("list_id", data.listId);
    if (error) throw new Error(error.message);

    const checked = (items ?? []).filter((item) => item.is_checked);
    const now = new Date().toISOString();

    const { error: listError } = await context.supabase
      .from("shopping_lists")
      .update({ status: "klar", completed_at: now })
      .eq("id", data.listId);
    if (listError) throw new Error(listError.message);

    const title =
      checked.length > 0
        ? `Handlat: ${checked.length} ${checked.length === 1 ? "vara" : "varor"}`
        : "Inköpslistan avslutad";

    const { error: reminderError } = await context.supabase.from("reminders").insert({
      user_id: context.userId,
      title,
      remind_at: now,
      is_done: true,
    });
    if (reminderError) throw new Error(reminderError.message);

    return { ok: true as const, count: checked.length, title };
  });

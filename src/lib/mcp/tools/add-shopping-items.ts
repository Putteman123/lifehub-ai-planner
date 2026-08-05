import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "add_shopping_items",
  title: "Lägg till varor i inköpslistan",
  description: "Lägg till en eller flera varor i den aktiva inköpslistan (skapas vid behov).",
  inputSchema: {
    items: z.array(z.string().min(1)).min(1).describe("Namn på varorna"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ items }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { supabase, userId } = session;

    const names = items.map((n) => n.trim()).filter(Boolean);
    if (!names.length) return textResult("Inga varor att lägga till.");

    const existing = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("status", "aktiv")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) return errorResult(existing.error.message);

    let listId = existing.data?.id;
    if (!listId) {
      const created = await supabase
        .from("shopping_lists")
        .insert({ user_id: userId, title: "Inköpslista" })
        .select("id")
        .single();
      if (created.error) return errorResult(created.error.message);
      listId = created.data.id;
    }

    const current = await supabase.from("shopping_items").select("name, sort_order").eq("list_id", listId);
    if (current.error) return errorResult(current.error.message);

    const taken = new Set((current.data ?? []).map((row) => row.name.trim().toLowerCase()));
    let order = Math.max(0, ...(current.data ?? []).map((row) => row.sort_order));
    const fresh = names.filter((name) => {
      const key = name.toLowerCase();
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    });
    if (!fresh.length) return textResult("Varorna fanns redan i listan.");

    const inserted = await supabase.from("shopping_items").insert(
      fresh.map((name) => ({
        user_id: userId,
        list_id: listId,
        name,
        source: "manuell" as const,
        sort_order: ++order,
      })),
    );
    if (inserted.error) return errorResult(inserted.error.message);

    return textResult(`La till ${fresh.length} varor i inköpslistan.`, { added: fresh });
  },
});

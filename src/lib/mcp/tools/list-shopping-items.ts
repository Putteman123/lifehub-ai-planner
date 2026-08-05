import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "list_shopping_items",
  title: "Visa inköpslistan",
  description: "Hämta varorna i den aktiva inköpslistan.",
  inputSchema: {
    include_checked: z.boolean().optional().describe("Ta med redan bockade varor, standard false"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_checked }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const list = await session.supabase
      .from("shopping_lists")
      .select("id, title")
      .eq("status", "aktiv")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (list.error) return errorResult(list.error.message);
    if (!list.data) return textResult("Det finns ingen aktiv inköpslista.", { items: [] });

    let query = session.supabase
      .from("shopping_items")
      .select("id, name, quantity, category, is_checked")
      .eq("list_id", list.data.id)
      .order("sort_order");
    if (!include_checked) query = query.eq("is_checked", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { list: list.data.title, items: data ?? [] });
  },
});

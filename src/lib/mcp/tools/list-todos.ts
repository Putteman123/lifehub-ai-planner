import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "list_todos",
  title: "Lista uppgifter",
  description: "Hämta uppgifter från Att göra-listan, öppna eller avklarade.",
  inputSchema: {
    include_done: z.boolean().optional().describe("Ta med avbockade uppgifter, standard false"),
    limit: z.number().int().min(1).max(200).optional().describe("Max antal, standard 50"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_done, limit }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    let query = session.supabase
      .from("todos")
      .select("id, title, notes, due_date, is_done, completed_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (!include_done) query = query.eq("is_done", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { todos: data ?? [] });
  },
});

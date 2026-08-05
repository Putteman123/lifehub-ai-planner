import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "complete_todo",
  title: "Bocka av uppgift",
  description: "Markera en uppgift som klar eller återöppna den.",
  inputSchema: {
    todo_id: z.string().uuid().describe("Uppgiftens id, hämtas med list_todos"),
    done: z.boolean().optional().describe("true = klar (standard), false = återöppna"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ todo_id, done }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const isDone = done ?? true;
    const { error } = await session.supabase
      .from("todos")
      .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
      .eq("id", todo_id);
    if (error) return errorResult(error.message);
    return textResult(isDone ? "Uppgiften är avbockad." : "Uppgiften är återöppnad.");
  },
});

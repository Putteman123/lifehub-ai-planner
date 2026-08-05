import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, isoDate, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "create_todo",
  title: "Skapa uppgift",
  description: "Lägg till en uppgift i Att göra-listan.",
  inputSchema: {
    title: z.string().min(1).describe("Vad som ska göras"),
    due_date: z.string().optional().describe("Deadline i ISO 8601"),
    notes: z.string().optional().describe("Anteckning"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { data, error } = await session.supabase
      .from("todos")
      .insert({
        user_id: session.userId,
        title: input.title,
        due_date: input.due_date ? isoDate(input.due_date, "due_date") : null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Uppgiften "${input.title}" ligger i Att göra.`, { id: data?.id });
  },
});

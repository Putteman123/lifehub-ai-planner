import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, isoDate, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "create_reminder",
  title: "Skapa påminnelse",
  description: "Skapa en påminnelse med tidpunkt.",
  inputSchema: {
    title: z.string().min(1).describe("Vad påminnelsen gäller"),
    remind_at: z.string().describe("Tidpunkt i ISO 8601"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { data, error } = await session.supabase
      .from("reminders")
      .insert({
        user_id: session.userId,
        title: input.title,
        remind_at: isoDate(input.remind_at, "remind_at"),
      })
      .select("id")
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Påminnelse "${input.title}" skapad.`, { id: data?.id });
  },
});

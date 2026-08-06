import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, isoDate, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "create_event",
  title: "Skapa kalenderhändelse",
  description: "Lägg till en ny händelse i användarens kalender.",
  inputSchema: {
    title: z.string().min(1).describe("Rubrik för händelsen"),
    starts_at: z.string().describe("Starttid i ISO 8601"),
    ends_at: z.string().describe("Sluttid i ISO 8601"),
    category: z
      .string()
      .describe("Kategori för färgkodning"),
    all_day: z.boolean().optional().describe("Heldagshändelse"),
    location: z.string().optional().describe("Plats"),
    description: z.string().optional().describe("Anteckning"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { data, error } = await session.supabase
      .from("events")
      .insert({
        user_id: session.userId,
        title: input.title,
        starts_at: isoDate(input.starts_at, "starts_at"),
        ends_at: isoDate(input.ends_at, "ends_at"),
        category: input.category,
        all_day: input.all_day ?? false,
        location: input.location ?? null,
        description: input.description ?? null,
      })
      .select("id")
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Händelsen "${input.title}" är inlagd.`, { id: data?.id });
  },
});

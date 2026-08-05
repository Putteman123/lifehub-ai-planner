import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, isoDate, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "list_events",
  title: "Lista kalenderhändelser",
  description:
    "Hämta kalenderhändelser för den inloggade användaren inom ett tidsintervall (ISO 8601).",
  inputSchema: {
    from: z.string().describe("Startdatum/tid i ISO 8601, t.ex. 2026-08-05T00:00:00Z"),
    to: z.string().describe("Slutdatum/tid i ISO 8601"),
    limit: z.number().int().min(1).max(200).optional().describe("Max antal händelser, standard 50"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { data, error } = await session.supabase
      .from("events")
      .select("id, title, starts_at, ends_at, all_day, category, location, description")
      .gte("starts_at", isoDate(from, "from"))
      .lte("starts_at", isoDate(to, "to"))
      .order("starts_at")
      .limit(limit ?? 50);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { events: data ?? [] });
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "list_visits",
  title: "Lista besök och resor",
  description:
    "Hämta de senaste posterna i platsloggen (besök och resor) med tider, etikett och sträcka.",
  inputSchema: {
    days: z.number().int().min(1).max(365).optional().describe("Antal dagar bakåt, standard 7"),
    limit: z.number().int().min(1).max(200).optional().describe("Max antal poster, standard 50"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, limit }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const since = new Date(Date.now() - (days ?? 7) * 86400000).toISOString();
    const { data, error } = await session.supabase
      .from("visits")
      .select("id, label, arrived_at, left_at, entry_kind, travel_mode, distance_m, place_id")
      .gte("arrived_at", since)
      .order("arrived_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { visits: data ?? [] });
  },
});

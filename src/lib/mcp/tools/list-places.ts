import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireUser, textResult } from "../helpers";

export default defineTool({
  name: "list_places",
  title: "Lista sparade platser",
  description: "Hämta användarens sparade platser med namn, typ och koordinater.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max antal platser, standard 100"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const session = requireUser(ctx);
    if (!session) return errorResult("Inte inloggad.");
    const { data, error } = await session.supabase
      .from("places")
      .select("id, name, kind, lat, lng, radius_m, address")
      .order("name")
      .limit(limit ?? 100);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { places: data ?? [] });
  },
});

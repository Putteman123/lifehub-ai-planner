import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  date: z.string().max(40),
  events: z
    .array(
      z.object({
        title: z.string().max(200),
        start: z.string().max(10),
        end: z.string().max(10),
        location: z.string().max(200).nullable().optional(),
        category: z.string().max(40).optional(),
      }),
    )
    .max(40),
});

export type DayBrief = {
  summary: string;
  priorities: string[];
  gaps: string[];
  warnings: string[];
  provider: string;
};

const schema = {
  name: "day_brief",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      priorities: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "priorities", "gaps", "warnings"],
    additionalProperties: false,
  },
};

export const getDayBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<DayBrief> => {
    const { completeTextDetailed } = await import("./ai-complete.server");
    const list = data.events.length
      ? data.events
          .map((e) => `- ${e.start}–${e.end} ${e.title}${e.location ? ` @ ${e.location}` : ""}${e.category ? ` [${e.category}]` : ""}`)
          .join("\n")
      : "(inga händelser)";
    const res = await completeTextDetailed({
      system:
        "Du är Andrea, en personlig planeringsassistent. Svara på svenska, kort och konkret. Ge JSON: summary (2–3 meningar om dagen), priorities (max 3 viktigaste sakerna), gaps (max 3 lediga luckor med tid, t.ex. 'Fokus 10:00–11:30' eller paus), warnings (krockar, tight schema, restid mellan olika platser; tom lista om inget).",
      input: `Datum: ${data.date}\nHändelser:\n${list}`,
      jsonSchema: schema as never,
    });
    try {
      const raw = res.text.replace(/^```(json)?|```$/g, "").trim();
      const p = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      return {
        summary: String(p.summary ?? ""),
        priorities: (p.priorities ?? []).slice(0, 3),
        gaps: (p.gaps ?? []).slice(0, 3),
        warnings: (p.warnings ?? []).slice(0, 3),
        provider: res.provider,
      };
    } catch {
      return { summary: res.text.slice(0, 400), priorities: [], gaps: [], warnings: [], provider: res.provider };
    }
  });

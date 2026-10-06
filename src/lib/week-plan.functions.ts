import { createServerFn } from "@tanstack/react-start";

export type WeekPlanDay = { day: string; focus: string; blocks: { time: string; task: string }[] };
export type WeekPlan = { summary: string; days: WeekPlanDay[]; tips: string[]; provider: string };

/** Gemini lägger en veckoplan utifrån kalender, uppgifter och lediga luckor. */
export const getWeekPlan = createServerFn({ method: "POST" })
  .inputValidator((d: { events: string; todos: string; slots: string; today: string }) => ({
    events: String(d.events ?? "").slice(0, 6000),
    todos: String(d.todos ?? "").slice(0, 4000),
    slots: String(d.slots ?? "").slice(0, 3000),
    today: String(d.today ?? "").slice(0, 40),
  }))
  .handler(async ({ data }): Promise<WeekPlan> => {
    const { completeTextDetailed } = await import("@/lib/ai-complete.server");
    const { text, provider } = await completeTextDetailed({
      feature: "week-plan",
      system:
        "Du är Andrea, svensk personlig planerare. Lägg en realistisk plan för kommande 7 dagar. " +
        "Fasta kalenderhändelser får aldrig flyttas. Placera uppgifter ENDAST i angivna lediga luckor, " +
        "prioritera deadlines, lägg in pauser och undvik överbelastade dagar. " +
        "days: en post per dag (day = t.ex. 'Mån 6 okt'), focus = en kort rad, blocks = högst 4 block " +
        "med time ('HH:MM–HH:MM') och task. summary = 1–2 meningar. tips = högst 3 korta råd. " +
        "Inga emojis. Svara enbart med JSON.",
      input: `Idag: ${data.today}\n\nKalender:\n${data.events || "(tom)"}\n\nUppgifter:\n${data.todos || "(inga)"}\n\nLediga luckor:\n${data.slots || "(inga)"}`,
      jsonSchema: {
        name: "week_plan",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "days", "tips"],
          properties: {
            summary: { type: "string" },
            tips: { type: "array", items: { type: "string" } },
            days: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["day", "focus", "blocks"],
                properties: {
                  day: { type: "string" },
                  focus: { type: "string" },
                  blocks: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["time", "task"],
                      properties: { time: { type: "string" }, task: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    try {
      const p = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()) as Partial<WeekPlan>;
      return {
        summary: p.summary ?? "",
        tips: (p.tips ?? []).slice(0, 3),
        days: (p.days ?? []).slice(0, 7).map((d) => ({ ...d, blocks: (d.blocks ?? []).slice(0, 4) })),
        provider,
      };
    } catch {
      throw new Error("Andrea kunde inte tolka veckoplanen. Försök igen.");
    }
  });

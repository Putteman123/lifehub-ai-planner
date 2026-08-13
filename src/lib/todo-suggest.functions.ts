import { createServerFn } from "@tanstack/react-start";

export type TodoPlanItem = {
  todoId: string;
  slot: string;
  minutes: number;
  why: string;
};

/** Andrea föreslår vilka uppgifter som passar i kalenderns lediga luckor. */
export const getTodoPlan = createServerFn({ method: "POST" })
  .inputValidator((input: { todos: string; slots: string }) => input)
  .handler(async ({ data }): Promise<{ items: TodoPlanItem[]; note: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");
    if (!data.todos.trim() || !data.slots.trim()) return { items: [], note: "" };

    const { completeText } = await import("@/lib/ai-complete.server");

    const text = await completeText({
      apiKey,
      system:
        "Du är Andrea, en svensk personlig assistent. Du får en lista med uppgifter (id, titel, ev. deadline och anteckning) och en lista med lediga luckor i kalendern de kommande dagarna. Välj ut 1–5 uppgifter som bör göras härnäst och placera varje i en konkret lucka. Prioritera försenade och snart förfallande uppgifter, och matcha uppgiftens rimliga tidsåtgång mot luckans längd – lägg aldrig en uppgift i en lucka som är för kort. todoId måste vara exakt ett id ur listan och slot exakt en av luckornas etiketter. minutes = hur många minuter du avsätter. why = en kort mening på svenska om varför just nu. note = en kort rad om helhetsbilden. Inga emojis, inga rubriker. Svara enbart med JSON.",
      input: `Uppgifter:\n${data.todos}\n\nLediga luckor:\n${data.slots}`,
      jsonSchema: {
        name: "todo_plan",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items", "note"],
          properties: {
            note: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["todoId", "slot", "minutes", "why"],
                properties: {
                  todoId: { type: "string" },
                  slot: { type: "string" },
                  minutes: { type: "number" },
                  why: { type: "string" },
                },
              },
            },
          },
        },
      },
    });

    try {
      const parsed = JSON.parse(text) as { items?: TodoPlanItem[]; note?: string };
      return { items: parsed.items ?? [], note: parsed.note ?? "" };
    } catch {
      return { items: [], note: "" };
    }
  });

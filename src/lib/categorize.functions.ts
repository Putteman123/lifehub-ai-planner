import { createServerFn } from "@tanstack/react-start";

/** Föreslår kategori för en fri text med AI, med enkel reserv om AI inte svarar. */
export const suggestCategoryAi = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; options: { value: string; label: string }[] }) => {
    if (!data || typeof data.text !== "string") throw new Error("Ogiltig text.");
    return {
      text: data.text.slice(0, 300),
      options: (data.options ?? []).slice(0, 40),
    };
  })
  .handler(async ({ data }) => {
    if (data.text.trim().length < 3 || data.options.length === 0) {
      return { category: null as string | null, reason: "" };
    }

    const { completeText } = await import("@/lib/ai-complete.server");
    const list = data.options.map((o) => `${o.value} = ${o.label}`).join("\n");

    try {
      const raw = await completeText({
        system:
          "Du kategoriserar poster i en svensk livsplaneringsapp. Välj exakt ett värde ur listan. " +
          "Svara med JSON: {\"category\":\"<värde>\",\"reason\":\"kort motivering på svenska\"}.",
        input: `Kategorier:\n${list}\n\nText: ${data.text}`,
        jsonSchema: {
          name: "kategori",
          schema: {
            type: "object",
            properties: {
              category: { type: "string" },
              reason: { type: "string" },
            },
            required: ["category"],
            additionalProperties: false,
          },
        },
      });

      const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim()) as {
        category?: string;
        reason?: string;
      };
      const valid = data.options.some((o) => o.value === parsed.category);
      return {
        category: valid ? (parsed.category as string) : null,
        reason: parsed.reason ?? "",
      };
    } catch (error) {
      console.warn("Kategoriförslag misslyckades", error);
      return { category: null as string | null, reason: "" };
    }
  });

import { createServerFn } from "@tanstack/react-start";

export type ModeSummary = {
  label: string;
  trips: number;
  km: number;
  minutes: number;
};

/** Kort AI-insikt om färdsätt och hur resorna kan optimeras. */
export const getTravelInsight = createServerFn({ method: "POST" })
  .inputValidator((input: { modes: ModeSummary[] }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");
    if (!data.modes.length) return { text: "" };

    const summary = data.modes
      .map(
        (m) =>
          `${m.label}: ${m.trips} resor, ${m.km.toFixed(1)} km, ${Math.round(m.minutes)} min`,
      )
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        stream: true,
        instructions:
          "Du är Andrea, en svensk personlig assistent. Svara på svenska, max 4 korta meningar, utan rubriker. Sammanfatta vilka färdsätt användaren använder mest och ge ett par konkreta förslag på hur framtida resor kan optimeras (tid, kostnad, klimat).",
        input: `Resestatistik senaste 90 dagarna:\n${summary}`,
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("För många AI-förfrågningar, försök snart igen.");
      if (res.status === 402) throw new Error("AI-krediterna är slut.");
      throw new Error(`AI-fel (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
          if (evt.type === "response.completed" && !text && evt.response?.output_text) {
            text = evt.response.output_text;
          }
        } catch {
          // ignorera ofullständiga event
        }
      }
    }

    return { text: text.trim() };
  });

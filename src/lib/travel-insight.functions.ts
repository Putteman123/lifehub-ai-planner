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

/** Andreas sammanfattning av kommande veckas reseplan. */
export const getWeeklyTravelPlanInsight = createServerFn({ method: "POST" })
  .inputValidator((input: { plan: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");
    if (!data.plan.trim()) return { text: "" };

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
          "Du är Andrea, en svensk personlig assistent. Svara på svenska, max 5 korta meningar, utan rubriker eller punktlistor. Du får en reseplan för kommande vecka med färdsätt, restid och marginal per aktivitet. Lyft vilket färdsätt som dominerar, peka ut de resor där marginalen är knapp eller negativ (status tight/conflict) med dag och tid, och ge konkreta råd: åk tidigare, byt färdsätt eller flytta aktiviteten.",
        input: `Reseplan kommande 7 dagar:\n${data.plan}`,
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

export type TrendInsight = {
  mode: string;
  headline: string;
  why: string;
  action: string;
};

/** Förklarar trendförändringen per färdsätt och föreslår åtgärder. */
export const getTravelTrendInsight = createServerFn({ method: "POST" })
  .inputValidator((input: { summary: string }) => input)
  .handler(async ({ data }): Promise<{ insights: TrendInsight[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI är inte konfigurerat.");
    if (!data.summary.trim()) return { insights: [] };

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
          "Du är Andrea, en svensk personlig assistent som analyserar resmönster. Du får statistik per färdsätt: senaste 4 veckorna mot de 4 veckorna innan, vardagsandel, vanligaste rutter samt topp- och lågvecka. Skriv ett objekt per färdsätt du fått data för, i samma ordning. Sätt mode till exakt det id som står inom hakparenteser, men utan hakparenteser (t.ex. bil). headline: max 6 ord om vad som hänt. why: 1–2 meningar som förklarar förändringen och som ALLTID hänvisar till konkreta siffror eller rutter ur underlaget – gissa aldrig om orsaker som inte syns i datat, säg hellre att orsaken är oklar. action: en konkret, genomförbar åtgärd med tids-, kostnads- eller klimatvinst. Allt på svenska, inga emojis, inga rubriker.",
        input: `Resestatistik per färdsätt (senaste 6 månaderna):\n${data.summary}`,
        text: {
          format: {
            type: "json_schema",
            name: "trend_insights",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["insights"],
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["mode", "headline", "why", "action"],
                    properties: {
                      mode: { type: "string" },
                      headline: { type: "string" },
                      why: { type: "string" },
                      action: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
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

    if (!text.trim()) return { insights: [] };
    try {
      const parsed = JSON.parse(text) as { insights?: TrendInsight[] };
      const insights = (parsed.insights ?? []).map((i) => ({
        ...i,
        mode: i.mode.replace(/[[\]]/g, "").trim(),
      }));
      return { insights };
    } catch {
      throw new Error("Kunde inte tolka AI-svaret, försök igen.");
    }
  });

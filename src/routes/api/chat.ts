import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import { findFreeSlot, suggestCategory } from "@/lib/calendar";

type Body = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI är inte konfigurerad.", { status: 500 });

        const authHeader = request.headers.get("authorization");
        const bearer = authHeader?.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : null;
        if (!bearer) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData } = await supabaseAdmin.auth.getUser(bearer);
        if (!userData?.user) return new Response("Unauthorized", { status: 401 });

        const { ANDREA_SYSTEM, buildAndreaContext } = await import("@/lib/andrea.server");
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

        const context = await buildAndreaContext();
        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("openai/gpt-5.6-sol"),
          system: `${ANDREA_SYSTEM}\n\nAKTUELLT UNDERLAG FRÅN KALENDERN:\n${context}`,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
          providerOptions: { lovable: { reasoningEffort: "none" } },
          tools: {
            goto: tool({
              description:
                "Föreslå en vy i appen som användaren ska öppna. UI:t hanterar navigeringen.",
              inputSchema: z.object({
                route: z.string().describe("Route i appen, t.ex. /kalender"),
                reason: z.string().describe("Kort förklaring varför."),
              }),
              execute: async ({ route, reason }) => ({ route, reason }),
            }),
            find_free_time: tool({
              description: "Hitta nästa lediga tidslucka av en viss längd.",
              inputSchema: z.object({
                minutes: z.number().describe("Hur många minuter som behövs."),
                reason: z.string().describe("Vad luckan ska användas till."),
              }),
              execute: async ({ minutes, reason }) => {
                const { buildAndreaContext } = await import("@/lib/andrea.server");
                const ctxText = await buildAndreaContext();
                const eventsMatch = ctxText.match(/Händelser \(kommande 21 dagar\):([\s\S]*?)(?=\n\n|$)/);
                const events: { starts_at: string; ends_at: string; all_day: boolean; category: string; title: string }[] = [];
                if (eventsMatch) {
                  const lines = eventsMatch[1].split("\n").filter((l) => l.startsWith("- "));
                  for (const line of lines) {
                    const m = line.match(/- (.+?) \| (\w+) \| (.+)/);
                    if (m && m[1] && m[2] && m[3]) {
                      const timePart = m[1];
                      const category = m[2];
                      const title = m[3];
                      const [start, end] = timePart.split("–");
                      if (start && end) {
                        events.push({
                          starts_at: new Date(start).toISOString(),
                          ends_at: new Date(end).toISOString(),
                          all_day: !timePart.includes(":"),
                          category,
                          title,
                        });
                      }
                    }
                  }
                }
                const slot = findFreeSlot(events as never, minutes, new Date(), 14);
                return { found: !!slot, slot, reason };
              },
            }),
            suggest_category: tool({
              description: "Föreslå en kategori för en ny händelse baserat på titeln.",
              inputSchema: z.object({
                title: z.string().describe("Händelsens titel."),
              }),
              execute: async ({ title }) => ({ category: suggestCategory(title) }),
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { findFreeSlot, suggestCategory } from "@/lib/calendar";

type Body = { messages?: unknown };

const CATEGORY = z.enum(["jobb", "ledig", "jurist", "barn", "privat", "viktigt"]);
const PLACE_KIND = z.enum(["jobb", "jurist", "hem", "barn", "annat"]);

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
        const userId = userData.user.id;

        const { ANDREA_SYSTEM, buildAndreaContext } = await import("@/lib/andrea.server");
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const agent = await import("@/lib/agent.server");

        const context = await buildAndreaContext();
        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("openai/gpt-5.6-sol"),
          system: `${ANDREA_SYSTEM}\n\nAKTUELLT UNDERLAG FRÅN KALENDERN:\n${context}`,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
          providerOptions: { lovable: { reasoningEffort: "none" } },
          stopWhen: stepCountIs(50),
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
                const { buildAndreaContext: build } = await import("@/lib/andrea.server");
                const ctxText = await build();
                const eventsMatch = ctxText.match(
                  /Händelser \(kommande 21 dagar\):([\s\S]*?)(?=\n\n|$)/,
                );
                const events: {
                  starts_at: string;
                  ends_at: string;
                  all_day: boolean;
                  category: string;
                  title: string;
                }[] = [];
                if (eventsMatch && eventsMatch[1]) {
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
              inputSchema: z.object({ title: z.string().describe("Händelsens titel.") }),
              execute: async ({ title }) => ({ category: suggestCategory(title) }),
            }),

            // --- Åtgärder som ändrar data. Kräver användarens godkännande. ---
            create_event: tool({
              description:
                "Skapa en ny kalenderhändelse. Tider anges som ISO 8601 i lokal tid, t.ex. 2026-08-06T18:00.",
              inputSchema: z.object({
                title: z.string(),
                starts_at: z.string(),
                ends_at: z.string(),
                category: CATEGORY,
                all_day: z.boolean().optional(),
                location: z.string().optional(),
                description: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.createEvent(userId, input),
            }),
            update_event: tool({
              description: "Ändra en befintlig kalenderhändelse. Använd händelsens id från underlaget.",
              inputSchema: z.object({
                event_id: z.string(),
                title: z.string().optional(),
                starts_at: z.string().optional(),
                ends_at: z.string().optional(),
                category: CATEGORY.optional(),
                all_day: z.boolean().optional(),
                location: z.string().optional(),
                description: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.updateEvent(userId, input),
            }),
            delete_event: tool({
              description: "Ta bort en kalenderhändelse.",
              inputSchema: z.object({ event_id: z.string(), title: z.string() }),
              needsApproval: true,
              execute: async ({ event_id }) => agent.deleteEvent(userId, event_id),
            }),
            create_todo: tool({
              description: "Lägg till en uppgift i Att göra. Sista datum är valfritt.",
              inputSchema: z.object({
                title: z.string(),
                due_date: z.string().optional(),
                notes: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.createTodo(userId, input),
            }),
            complete_todo: tool({
              description: "Bocka av en uppgift så den arkiveras.",
              inputSchema: z.object({ todo_id: z.string(), title: z.string() }),
              needsApproval: true,
              execute: async ({ todo_id }) => agent.completeTodo(userId, todo_id),
            }),
            delete_todo: tool({
              description: "Ta bort en uppgift helt.",
              inputSchema: z.object({ todo_id: z.string(), title: z.string() }),
              needsApproval: true,
              execute: async ({ todo_id }) => agent.deleteTodo(userId, todo_id),
            }),
            create_reminder: tool({
              description: "Skapa en påminnelse vid en viss tidpunkt.",
              inputSchema: z.object({ title: z.string(), remind_at: z.string() }),
              needsApproval: true,
              execute: async (input) => agent.createReminder(userId, input),
            }),
            create_case: tool({
              description: "Skapa ett nytt juristärende.",
              inputSchema: z.object({
                title: z.string(),
                client_name: z.string().optional(),
                description: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.createCase(userId, input),
            }),
            create_case_task: tool({
              description: "Lägg till en juristuppgift eller deadline.",
              inputSchema: z.object({
                title: z.string(),
                due_date: z.string().optional(),
                case_id: z.string().optional(),
                notes: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.createCaseTask(userId, input),
            }),
            create_child: tool({
              description: "Lägg till ett barn.",
              inputSchema: z.object({ name: z.string(), birth_date: z.string().optional() }),
              needsApproval: true,
              execute: async (input) => agent.createChild(userId, input),
            }),
            create_place: tool({
              description: "Spara en ny plats med koordinater.",
              inputSchema: z.object({
                name: z.string(),
                lat: z.number(),
                lng: z.number(),
                kind: PLACE_KIND,
                radius_m: z.number().optional(),
                address: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.createPlace(userId, input),
            }),
            update_place: tool({
              description: "Byt namn, typ eller radie på en sparad plats.",
              inputSchema: z.object({
                place_id: z.string(),
                name: z.string().optional(),
                kind: PLACE_KIND.optional(),
                radius_m: z.number().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.updatePlace(userId, input),
            }),
            delete_place: tool({
              description:
                "Ta bort en sparad plats. Sätt delete_visits till true bara om besöken också ska raderas.",
              inputSchema: z.object({
                place_id: z.string(),
                name: z.string(),
                delete_visits: z.boolean().optional(),
              }),
              needsApproval: true,
              execute: async ({ place_id, delete_visits }) =>
                agent.deletePlace(userId, place_id, delete_visits ?? false),
            }),
            name_visit: tool({
              description: "Namnge ett okänt besök eller rätta en felaktig resa i platsloggen.",
              inputSchema: z.object({
                visit_id: z.string(),
                label: z.string(),
                note: z.string().optional(),
              }),
              needsApproval: true,
              execute: async (input) => agent.labelVisit(userId, input),
            }),
            delete_visit: tool({
              description: "Ta bort ett besök eller en resa ur platsloggen.",
              inputSchema: z.object({ visit_id: z.string(), label: z.string() }),
              needsApproval: true,
              execute: async ({ visit_id }) => agent.deleteVisit(userId, visit_id),
            }),
            check_in: tool({
              description: "Checka in på en sparad plats.",
              inputSchema: z.object({ place_id: z.string(), name: z.string() }),
              needsApproval: true,
              execute: async ({ place_id }) => agent.checkInAtPlace(userId, place_id),
            }),
            end_visit: tool({
              description: "Avsluta det pågående besöket.",
              inputSchema: z.object({}),
              needsApproval: true,
              execute: async () => agent.endVisit(userId),
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

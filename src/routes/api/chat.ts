import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

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
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});

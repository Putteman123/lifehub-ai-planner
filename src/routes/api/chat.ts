import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { ANDREA_MODEL, ANDREA_QUICK_MODEL } from "@/lib/ai-models";
import { findFreeSlot, suggestCategory } from "@/lib/calendar";

type Body = { messages?: unknown };

const CATEGORY = z
  .string()
  .describe(
    'Kategori: "jobb", "ledig", "jurist", "barn", "privat", "viktigt" eller ett eget kategorinamn.',
  );
const PLACE_KIND = z.enum(["jobb", "jurist", "hem", "barn", "annat"]);

/** Så hanterar Andrea bilder och dokument som Patrick laddar upp i chatten. */
const UPLOAD_RULES = `BIFOGADE FILER:
Patrick kan bifoga bilder och PDF:er. Varje bifogad fil beskrivs i meddelandet med filnamn, filtyp och lagringsväg (t.ex. "lagringsväg: <uuid>/<fil>").
Gör alltid så här:
1. Titta på filen och beskriv kort vad du ser (typ av dokument, belopp, datum, plats, viktiga uppgifter).
2. Föreslå vart den hör hemma – kvitto/faktura, kassaskåpet, ekonomifilerna, kalender/påminnelse eller "bara analys".
3. Spara ALDRIG något på eget bevåg. Vänta på att Patrick säger ja, och använd sedan rätt verktyg med exakt den lagringsväg som stod i meddelandet.
Kvitton: använd read_uploaded_receipt för att läsa av det, redovisa belopp, butik, datum och varor, och fråga vilket konto beloppet ska dras från innan du bokför med add_spend. Varorna läggs i skafferiet med add_pantry_items och butiken markeras med log_receipt_place.
Dokument, skärmdumpar och lösenordsbilder: save_uploaded_file med target "kassaskap". Ekonomipapper: target "ekonomi".
Filer som nämnts tidigare i samtalet kan användas igen – lagringsvägen står kvar i historiken.`;

/** Hur Andrea agerar som assistent i stället för allmän chatt. */
const LANE_RULES = `SÅ ARBETAR DU:
- Nämner Patrick något vid namn ("bocka av inlagan till tingsrätten") – slå upp det med find_item och utför sedan åtgärden. Fråga ALDRIG efter ett id.
- Flera träffar: lista dem kort och fråga vilken. Ingen träff: föreslå de närmaste alternativen. Låt dig aldrig låsa dig i frågor fram och tillbaka.
- Ofarliga åtgärder (bocka av, lägga till uppgift, registrera köp, navigera) utför du direkt och bekräftar med en rad. Radering, kassaskåp och utgående mejl kräver godkännande.
- Håller Patrick på med samma sak i flera meddelanden: kom ihåg vad "den" och "samma" syftar på.
- Avsluta varje åtgärd med vad du gjorde, inte med en fråga om lov.`

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

        const { ANDREA_SYSTEM, buildAndreaContext, buildAndreaQuickContext } = await import(
          "@/lib/andrea.server",
        );
        const { createOpenAI } = await import("@ai-sdk/openai");
        const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
        const agent = await import("@/lib/agent.server");
        const { routeAndreaTurn } = await import("@/lib/andrea-router.server");
        const { QUICK_TOOLS, SAFE_TOOLS } = await import("@/lib/agent-tools");

        // Vilken fil ska turen gå? Snabbfilen (Gemini) eller djupfilen (ChatGPT).
        const uiMessages = body.messages as UIMessage[];
        const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
        const lastUserText = (lastUser?.parts ?? [])
          .map((p) => (p.type === "text" ? p.text : ""))
          .join(" ");
        const hasAttachments = (lastUser?.parts ?? []).some((p) => p.type === "file");
        const lane =
          uiMessages.length > 24
            ? "deep"
            : await routeAndreaTurn({ apiKey: key, lastUserText, hasAttachments });

        const context =
          lane === "quick"
            ? await buildAndreaQuickContext(userId)
            : await buildAndreaContext(userId);
        // ChatGPT-modellerna körs via Lovable AI Gateways Responses API.
        const openai = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });
        // Gemini-modellerna körs via chat completions på samma gateway.
        const gemini = createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        });

        const allTools = {
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
                const now = new Date();
                const { data: events } = await supabaseAdmin
                  .from("events")
                  .select("*")
                  .eq("user_id", userId)
                  .gte("ends_at", now.toISOString())
                  .lte("starts_at", new Date(now.getTime() + 21 * 86400000).toISOString())
                  .order("starts_at");
                const slot = findFreeSlot(events ?? [], minutes, now, 14);
                return { found: !!slot, slot, reason };
              },

            }),
            suggest_category: tool({
              description: "Föreslå en kategori för en ny händelse baserat på titeln.",
              inputSchema: z.object({ title: z.string().describe("Händelsens titel.") }),
              execute: async ({ title }) => ({ category: suggestCategory(title) }),
            }),
            web_search: tool({
              description:
                "Sök på webben i realtid via Perplexity. Använd för färsk information: nyheter, öppettider, restider, priser, lagändringar, matchtider, väder.",
              inputSchema: z.object({
                query: z.string().describe("Sökfrågan, gärna på svenska."),
                mode: z.enum(["web", "academic"]).nullable(),
              }),
              execute: async ({ query, mode }) => {
                const { searchWeb } = await import("@/lib/websearch.server");
                try {
                  return await searchWeb(query, mode ?? "web");
                } catch (error) {
                  return { error: error instanceof Error ? error.message : "Sökningen misslyckades." };
                }
              },
            }),
            gmail_search: tool({
              description:
                "Sök i Gmail. Använd Gmails sökspråk, t.ex. 'is:unread in:inbox'. Patricks mejlregler (etiketter/avsändare/nyckelord) läggs på automatiskt.",
              inputSchema: z.object({
                query: z.string(),
                max: z.number().min(1).max(20).nullable(),
              }),
              execute: async ({ query, max }) => {
                const { gmailList, mailQueryWithRules } = await import("@/lib/google.server");
                try {
                  const q = await mailQueryWithRules(query);
                  return { mails: await gmailList(q, max ?? 8) };
                } catch (error) {
                  return { error: error instanceof Error ? error.message : "Gmail-fel." };
                }
              },
            }),
            drive_search: tool({
              description: "Sök dokument i Google Drive på filnamn.",
              inputSchema: z.object({ query: z.string() }),
              execute: async ({ query }) => {
                const { driveSearch } = await import("@/lib/google.server");
                try {
                  return { files: await driveSearch(query, 10) };
                } catch (error) {
                  return { error: error instanceof Error ? error.message : "Drive-fel." };
                }
              },
            }),
            google_route: tool({
              description:
                "Räkna ut restid och sträcka mellan två koordinater med Google Maps. Färdsätt: bil, kollektivt eller gang_cykel.",
              inputSchema: z.object({
                from_lat: z.number(),
                from_lng: z.number(),
                to_lat: z.number(),
                to_lng: z.number(),
                mode: z.enum(["bil", "kollektivt", "gang_cykel"]).nullable(),
              }),
              execute: async (input) => {
                const { mapsRoute } = await import("@/lib/google.server");
                try {
                  return await mapsRoute(
                    { lat: input.from_lat, lng: input.from_lng },
                    { lat: input.to_lat, lng: input.to_lng },
                    input.mode ?? "bil",
                  );
                } catch (error) {
                  return { error: error instanceof Error ? error.message : "Maps-fel." };
                }
              },
            }),
            send_mail: tool({
              description: "Skicka ett mejl från Gmail.",
              inputSchema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
              needsApproval: true,
              execute: async ({ to, subject, body }) => {
                const { gmailSend } = await import("@/lib/google.server");
                await gmailSend(to, subject, body);
                return { ok: true, message: `Mejlet till ${to} är skickat.` };
              },
            }),
            create_google_doc: tool({
              description: "Skapa ett nytt Google-dokument med given titel och text.",
              inputSchema: z.object({ title: z.string(), text: z.string() }),
              needsApproval: true,
              execute: async ({ title, text }) => {
                const { docsCreate } = await import("@/lib/google.server");
                const doc = await docsCreate(title, text);
                return { ok: true, message: `Dokumentet är skapat: ${doc.link}` };
              },
            }),
            export_to_sheet: tool({
              description:
                "Exportera tabelldata till ett nytt Google Sheet. Första raden är rubrikrad.",
              inputSchema: z.object({
                title: z.string(),
                rows: z.array(z.array(z.string())),
              }),
              needsApproval: true,
              execute: async ({ title, rows }) => {
                const { sheetsExport } = await import("@/lib/google.server");
                const sheet = await sheetsExport(title, rows);
                return { ok: true, message: `Kalkylarket är klart: ${sheet.link}` };
              },
            }),

            // --- Filer som Patrick laddat upp i chatten ---
            read_uploaded_receipt: tool({
              description:
                "Läs av ett uppladdat kvitto eller en faktura (bild eller PDF) och få ut belopp, butik, datum, adress, kategori, varor, tobak, rabatter (discounts), övriga rader (other: kasse/pant, läggs aldrig i skafferiet) samt balanskontroll (balanced/diff: stämmer varor + tobak + övrigt − rabatter mot totalen). Nämn rabatt, tobaksuppdelning och om summan balanserar i ditt svar. Sparar ingenting.",
              inputSchema: z.object({
                storage_path: z.string().describe("Lagringsvägen som stod i meddelandet."),
                file_name: z.string(),
                mime_type: z.string().nullable(),
              }),
              execute: async ({ storage_path, file_name, mime_type }) => {
                const files = await import("@/lib/andrea-files.server");
                try {
                  return await files.readAttachmentReceipt(userId, {
                    storage_path,
                    file_name,
                    ...(mime_type ? { mime_type } : {}),
                  });
                } catch (error) {
                  return {
                    error: error instanceof Error ? error.message : "Kunde inte läsa filen.",
                  };
                }
              },
            }),
            save_uploaded_file: tool({
              description:
                "Spara en uppladdad fil i kassaskåpet (target kassaskap) eller bland ekonomifilerna (target ekonomi).",
              inputSchema: z.object({
                storage_path: z.string(),
                file_name: z.string(),
                mime_type: z.string().nullable(),
                target: z.enum(["kassaskap", "ekonomi"]),
                caption: z.string().nullable(),
                kind: z.enum(["kvitto", "faktura", "underlag"]).nullable(),
              }),
              needsApproval: true,
              execute: async (input) => {
                const files = await import("@/lib/andrea-files.server");
                return files.saveAttachment(userId, {
                  storage_path: input.storage_path,
                  file_name: input.file_name,
                  target: input.target,
                  ...(input.mime_type ? { mime_type: input.mime_type } : {}),
                  ...(input.caption ? { caption: input.caption } : {}),
                  ...(input.kind ? { kind: input.kind } : {}),
                });
              },
            }),
            add_pantry_items: tool({
              description:
                "Lägg varor från ett kvitto i skafferiet under Handla (utan att röra inköpslistan).",
              inputSchema: z.object({ items: z.array(z.string()) }),
              needsApproval: true,
              execute: async ({ items }) => {
                const files = await import("@/lib/andrea-files.server");
                return files.addPantryItems(userId, items);
              },
            }),
            log_receipt_place: tool({
              description:
                "Markera butiken från ett kvitto som besök på kartan och lägg in köpet i kalendern.",
              inputSchema: z.object({
                merchant: z.string(),
                address: z.string().nullable(),
                spent_at: z.string().describe("Datum och tid, t.ex. 2026-08-18T17:30"),
                amount: z.number().nullable(),
                category: z.string().nullable(),
                add_event: z.boolean().nullable(),
              }),
              needsApproval: true,
              execute: async (input) => {
                const files = await import("@/lib/andrea-files.server");
                return files.logReceiptContext(userId, {
                  merchant: input.merchant,
                  spent_at: input.spent_at,
                  ...(input.address ? { address: input.address } : {}),
                  ...(input.amount !== null ? { amount: input.amount } : {}),
                  ...(input.category ? { category: input.category } : {}),
                  ...(input.add_event !== null ? { add_event: input.add_event } : {}),
                });
              },
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
            add_shopping_items: tool({
              description: "Lägg till dagligvaror i den aktiva inköpslistan under Handla.",
              inputSchema: z.object({ items: z.array(z.string()) }),
              needsApproval: true,
              execute: async (input) => agent.addShoppingItems(userId, input),
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
            mark_travel: tool({
              description:
                "Markera ett besök i platsloggen som resa. Appen räknar själv ut start, slut, sträcka och färdsätt.",
              inputSchema: z.object({ visit_id: z.string(), label: z.string() }),
              needsApproval: true,
              execute: async ({ visit_id }) => agent.markTravel(userId, visit_id),
            }),
            merge_travels: tool({
              description:
                "Slå ihop flera reseposter i följd till en enda resa med total sträcka och tid.",
              inputSchema: z.object({ visit_ids: z.array(z.string()).min(2) }),
              needsApproval: true,
              execute: async ({ visit_ids }) => agent.mergeTravels(userId, visit_ids),
            }),
            analyze_travel_trend: tool({
              description:
                "Hämta trendunderlag per färdsätt (bil, kollektivt, gång/cykel): senaste 4 veckorna mot föregående 4, vanligaste rutter, vardagsandel och topp-/lågvecka. Använd vid frågor om varför resmönstret förändrats eller hur resandet kan optimeras.",
              inputSchema: z.object({ days: z.number().min(30).max(365).nullable() }),
              execute: async ({ days }) => agent.analyzeTravelTrend(userId, days ?? 180),
            }),
            plan_week_travel: tool({
              description:
                "Hämta reseplan för kommande dagar: bästa färdsätt, restid, avresetid och marginal per aktivitet med känd plats. Använd vid frågor om hur användaren tar sig till kommande aktiviteter.",
              inputSchema: z.object({ days: z.number().min(1).max(14).nullable() }),
              execute: async ({ days }) => agent.planWeekTravel(userId, days ?? 7),
            }),
            save_travel_preference: tool({
              description:
                "Spara prefererat färdsätt för en rutt (route_key som 'Jobb→Hem') eller en veckodag (0=måndag).",
              inputSchema: z.object({
                kind: z.enum(["rutt", "veckodag"]),
                route_key: z.string().optional(),
                weekday: z.number().min(0).max(6).optional(),
                preferred_mode: z.enum(["bil", "kollektivt", "gang_cykel", "okant"]),
              }),
              needsApproval: true,
              execute: async (input) => agent.saveTravelPreference(userId, input),
            }),

            update_todo: tool({
              description: "Rätta en uppgift i Att göra: titel, datum eller anteckning.",
              inputSchema: z.object({
                todo_id: z.string(),
                title: z.string().nullable(),
                due_date: z.string().nullable(),
                notes: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ todo_id, title, due_date, notes }) =>
                agent.updateTodo(userId, {
                  todo_id,
                  ...(title !== null ? { title } : {}),
                  ...(due_date !== null ? { due_date } : {}),
                  ...(notes !== null ? { notes } : {}),
                }),
            }),
            update_reminder: tool({
              description: "Rätta eller bocka av en påminnelse.",
              inputSchema: z.object({
                reminder_id: z.string(),
                title: z.string().nullable(),
                remind_at: z.string().nullable(),
                is_done: z.boolean().nullable(),
              }),
              needsApproval: true,
              execute: async ({ reminder_id, title, remind_at, is_done }) =>
                agent.updateReminder(userId, {
                  reminder_id,
                  ...(title !== null ? { title } : {}),
                  ...(remind_at !== null ? { remind_at } : {}),
                  ...(is_done !== null ? { is_done } : {}),
                }),
            }),
            delete_reminder: tool({
              description: "Ta bort en påminnelse.",
              inputSchema: z.object({ reminder_id: z.string() }),
              needsApproval: true,
              execute: async ({ reminder_id }) => agent.deleteReminder(userId, reminder_id),
            }),
            update_case: tool({
              description: "Rätta ett juristärende i LifeHub.",
              inputSchema: z.object({
                case_id: z.string(),
                title: z.string().nullable(),
                client_name: z.string().nullable(),
                status: z.string().nullable(),
                description: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ case_id, title, client_name, status, description }) =>
                agent.updateCase(userId, {
                  case_id,
                  ...(title !== null ? { title } : {}),
                  ...(client_name !== null ? { client_name } : {}),
                  ...(status !== null ? { status } : {}),
                  ...(description !== null ? { description } : {}),
                }),
            }),
            update_case_task: tool({
              description: "Rätta eller bocka av en juristuppgift.",
              inputSchema: z.object({
                task_id: z.string(),
                title: z.string().nullable(),
                due_date: z.string().nullable(),
                is_done: z.boolean().nullable(),
              }),
              needsApproval: true,
              execute: async ({ task_id, title, due_date, is_done }) =>
                agent.updateCaseTask(userId, {
                  task_id,
                  ...(title !== null ? { title } : {}),
                  ...(due_date !== null ? { due_date } : {}),
                  ...(is_done !== null ? { is_done } : {}),
                }),
            }),
            update_visit: tool({
              description:
                "Rätta en post i platsloggen: namn, tider, sträcka i km, färdsätt eller typ (besök/resa).",
              inputSchema: z.object({
                visit_id: z.string(),
                label: z.string().nullable(),
                arrived_at: z.string().nullable(),
                left_at: z.string().nullable(),
                distance_km: z.number().nullable(),
                travel_mode: z.enum(["bil", "kollektivt", "gang_cykel", "okant"]).nullable(),
                entry_kind: z.enum(["besok", "resa"]).nullable(),
                note: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async (input) =>
                agent.updateVisit(userId, {
                  visit_id: input.visit_id,
                  ...(input.label !== null ? { label: input.label } : {}),
                  ...(input.arrived_at !== null ? { arrived_at: input.arrived_at } : {}),
                  ...(input.left_at !== null ? { left_at: input.left_at } : {}),
                  ...(input.distance_km !== null ? { distance_km: input.distance_km } : {}),
                  ...(input.travel_mode !== null ? { travel_mode: input.travel_mode } : {}),
                  ...(input.entry_kind !== null ? { entry_kind: input.entry_kind } : {}),
                  ...(input.note !== null ? { note: input.note } : {}),
                }),
            }),
            analyze_day: tool({
              description:
                "Kartlägg en dag utifrån positionshistoriken: dela upp i stopp och resor med förslag på platsnamn och aktivitet. Datum som ÅÅÅÅ-MM-DD.",
              inputSchema: z.object({ day: z.string() }),
              execute: async ({ day }) => agent.analyzeDayForUser(userId, day),
            }),
            finance_overview: tool({
              description:
                "Hämta ekonomiöversikt: kontosaldon, nästa inbetalning, dagsbudget, fasta utgifter och utgifter senaste 30 dagarna.",
              inputSchema: z.object({}),
              execute: async () => agent.financeOverview(userId),
            }),
            add_spend: tool({
              description:
                "Registrera en utgift. Anges kontonamn dras beloppet från det kontot.",
              inputSchema: z.object({
                amount: z.number(),
                note: z.string().nullable(),
                category: z.string().nullable(),
                account_name: z.string().nullable(),
                spent_at: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ amount, note, category, account_name, spent_at }) =>
                agent.addSpend(userId, {
                  amount,
                  ...(note !== null ? { note } : {}),
                  ...(category !== null ? { category } : {}),
                  ...(account_name !== null ? { account_name } : {}),
                  ...(spent_at !== null ? { spent_at } : {}),
                }),
            }),
            set_account_balance: tool({
              description: "Sätt saldot på ett konto.",
              inputSchema: z.object({ account_name: z.string(), balance: z.number() }),
              needsApproval: true,
              execute: async (input) => agent.setAccountBalance(userId, input),
            }),
            save_fixed_expense: tool({
              description: "Lägg till eller ändra en fast månadsutgift (hyra, el, bredband).",
              inputSchema: z.object({
                name: z.string(),
                amount: z.number(),
                due_day: z.number().min(1).max(31),
                category: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ name, amount, due_day, category }) =>
                agent.saveFixedExpense(userId, {
                  name,
                  amount,
                  due_day,
                  ...(category !== null ? { category } : {}),
                }),
            }),
            vault_lookup: tool({
              description:
                "Slå upp lösenord, pinkoder och koder i kassaskåpet. Läs bara upp hemligheten när Patrick själv frågar efter den.",
              inputSchema: z.object({ query: z.string() }),
              needsApproval: true,
              execute: async ({ query }) => agent.vaultLookup(userId, query),
            }),
            vault_save: tool({
              description: "Spara eller uppdatera ett lösenord/en kod i kassaskåpet.",
              inputSchema: z.object({
                title: z.string(),
                secret: z.string(),
                kind: z.enum(["losenord", "pinkod", "kod", "anteckning"]).nullable(),
                username: z.string().nullable(),
                url: z.string().nullable(),
                notes: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ title, secret, kind, username, url, notes }) =>
                agent.vaultSave(userId, {
                  title,
                  secret,
                  ...(kind !== null ? { kind } : {}),
                  ...(username !== null ? { username } : {}),
                  ...(url !== null ? { url } : {}),
                  ...(notes !== null ? { notes } : {}),
                }),
            }),
            vault_delete: tool({
              description: "Ta bort en post ur kassaskåpet.",
              inputSchema: z.object({ item_id: z.string() }),
              needsApproval: true,
              execute: async ({ item_id }) => agent.vaultDelete(userId, item_id),
            }),
            remember_about_me: tool({
              description:
                "Spara hur du ska bemöta Patrick: tilltalsnamn, ton, hur rakt du ska svara (1-5) och vad du ska fokusera på.",
              inputSchema: z.object({
                call_name: z.string().nullable(),
                tone: z.string().nullable(),
                directness: z.number().min(1).max(5).nullable(),
                focus: z.string().nullable(),
                notes: z.string().nullable(),
              }),
              needsApproval: true,
              execute: async ({ call_name, tone, directness, focus, notes }) =>
                agent.saveAndreaProfile(userId, {
                  ...(call_name !== null ? { call_name } : {}),
                  ...(tone !== null ? { tone } : {}),
                  ...(directness !== null ? { directness } : {}),
                  ...(focus !== null ? { focus } : {}),
                  ...(notes !== null ? { notes } : {}),
                }),
            }),
            legal_search_cases: tool({
              description:
                "Sök ärenden i juristappen (PM Juridik). Endast läsning. Använd vid juridiska frågor om pågående ärenden.",
              inputSchema: z.object({ query: z.string() }),
              execute: async ({ query }) => agent.applesCases(query),
            }),
            legal_get_case: tool({
              description: "Hämta ett ärende med sakomständigheter och dokument ur juristappen.",
              inputSchema: z.object({ case_id: z.string() }),
              execute: async ({ case_id }) => agent.applesCase(case_id),
            }),
            legal_search_clients: tool({
              description: "Sök klienter i juristappen (namn, klientkod eller e-post).",
              inputSchema: z.object({ query: z.string() }),
              execute: async ({ query }) => agent.applesClients(query),
            }),
            legal_search_documents: tool({
              description: "Sök dokument i juristappen på titel.",
              inputSchema: z.object({ query: z.string() }),
              execute: async ({ query }) => agent.applesDocuments(query),
            }),
            legal_deadlines: tool({
              description: "Kommande deadlines och förhandlingar i juristappen.",
              inputSchema: z.object({ days: z.number().min(1).max(180).nullable() }),
              execute: async ({ days }) => agent.applesDeadlines(days ?? 30),
            }),
            find_item: tool({
              description:
                "Slå upp id för en sak Patrick nämner vid namn: juristuppgift, att göra, händelse, påminnelse, fast utgift, plats eller ärende. Använd ALLTID detta innan du ändrar något du inte har ett id för.",
              inputSchema: z.object({
                query: z.string().describe("Ord ur namnet, t.ex. 'inlagan tingsrätten'."),
                types: z
                  .array(
                    z.enum([
                      "case_task",
                      "todo",
                      "event",
                      "reminder",
                      "fixed_expense",
                      "place",
                      "legal_case",
                    ]),
                  )
                  .nullable()
                  .describe("Begränsa sökningen till vissa typer, eller null för alla."),
              }),
              execute: async ({ query, types }) =>
                agent.findItem(userId, query, types ?? undefined),
            }),
        };

        // Ofarliga, lätt ångrade åtgärder körs utan manuellt godkännande.
        const toolEntries = Object.entries(allTools).filter(
          ([name]) => lane === "deep" || QUICK_TOOLS.has(name),
        );
        const tools = Object.fromEntries(
          toolEntries.map(([name, def]) =>
            SAFE_TOOLS.has(name) ? [name, { ...def, needsApproval: false }] : [name, def],
          ),
        ) as typeof allTools;

        const result = streamText({
          model: lane === "quick" ? gemini(ANDREA_QUICK_MODEL) : openai.responses(ANDREA_MODEL),
          system: `${ANDREA_SYSTEM}\n\n${UPLOAD_RULES}\n\n${LANE_RULES}\n\nAKTUELLT UNDERLAG FRÅN KALENDERN:\n${context}`,
          messages: await convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(lane === "quick" ? 12 : 50),
          tools,
          ...(lane === "deep"
            ? {
                providerOptions: {
                  openai: {
                    // Gateway-modell-id känns inte igen som resonemangsmodell utan detta.
                    forceReasoning: true,
                    reasoningEffort: "medium",
                    reasoningSummary: "auto",
                    // Gateway är tillståndslös: historiken skickas med varje gång.
                    store: false,
                    include: ["reasoning.encrypted_content"],
                    // Verktygsschemana använder valfria fält – kör inte strikt läge.
                    strictJsonSchema: false,
                  },
                },
              }
            : {}),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          sendReasoning: true,
        });
      },

    },
  },
});

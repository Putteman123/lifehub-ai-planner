# Andrea: rätt tider + ChatGPT

## Problemet med tiderna

Andreas underlag byggs på servern, som kör i UTC. Alla klockslag hon läser upp (”Nu:”, händelser, påminnelser, platslogg) formateras utan tidszon och blir därför 2 timmar fel mot svensk sommartid. Samma sak åt andra hållet: när hon skapar en händelse klockan 18:00 tolkas den som 18:00 UTC och hamnar 20:00 i kalendern.

## Vad som fixas

1. **Alla tider tolkas och visas i Europe/Stockholm**
   - Underlaget till Andrea (`src/lib/andrea.server.ts`) formateras med `timeZone: "Europe/Stockholm"` — datum, klockslag, "Nu:" och platsloggen.
   - När Andrea skapar/ändrar händelser, påminnelser och uppgifter (`src/lib/agent.server.ts`) tolkas tider utan tidszonsuffix som svensk tid, inte UTC.
   - Systemprompten får en tydlig regel: alla tider är svensk lokaltid.

2. **Bättre sammanfattning**
   - Underlaget grupperas som "Idag", "Imorgon" och "Kommande" med veckodag, så hon inte blandar ihop dagar.
   - Pågående och redan passerade händelser markeras, så hon inte föreslår saker som redan hänt.

3. **Hydreringsfel på låsskärmen** åtgärdas i samma veva (påverkar inte Andrea direkt, men syns i loggen).

## ChatGPT till Andrea

Två saker, båda ingår:

**A. Andrea drivs av ChatGPT-modellen.** Standardmodellen byts från Gemini till OpenAI:s `openai/gpt-5.6-sol` via Lovable AI Gateway (ingen egen OpenAI-nyckel behövs, ingen inloggning). Det kräver att chatt-anropet flyttas till Responses-API:t, som är det OpenAI-modeller använder — verktygen (kalender, Gmail, Drive, webbsök, platser) fungerar likadant, och du får dessutom se hennes resonemang medan hon tänker. Perplexity ligger kvar för realtidssök.

**B. Din ChatGPT-app kopplas till LifeHub.** Appen har redan en MCP-server på `/mcp`. Så här kopplar du in den i ChatGPT (jag skriver ut exakta steg och adressen i chatten när planen är genomförd):
1. Publicera appen.
2. I ChatGPT: Inställningar → Kopplingar/Connectors → Lägg till → klistra in `https://lifehub-ai-planner.lovable.app/mcp`.
3. Logga in med ditt LifeHub-konto och godkänn på samtyckessidan.
4. ChatGPT kan sedan läsa kalender, lägga upp händelser, hantera Att göra, påminnelser, inköpslista och platslogg — som dig.

## Tekniska detaljer

- `src/lib/andrea.server.ts`: gemensam `fmt`-hjälpare med `timeZone: "Europe/Stockholm"`; dagsgruppering i kontexten.
- `src/lib/agent.server.ts`: `iso()` tolkar tidszonslösa strängar som Stockholm-tid innan de sparas.
- `src/lib/ai-models.ts`: `ANDREA_MODEL = "openai/gpt-5.6-sol"`.
- `src/routes/api/chat.ts`: byter till `@ai-sdk/openai` `openai.responses(...)` mot `https://ai.gateway.lovable.dev/v1`, med `forceReasoning`, `reasoningEffort: "medium"`, `store: false` och `include: ["reasoning.encrypted_content"]`. Verktygsscheman görs strict-kompatibla (alla fält required, valfria som `.nullable()`).
- `src/components/andrea/Andrea.tsx`: renderar reasoning-delar som ett diskret "Andrea tänker…"-block ovanför svaret.
- `src/lib/ai-complete.server.ts`: övriga engångsanrop (insikter, förslag) hålls kvar på en Gemini-modell så inget annat påverkas.

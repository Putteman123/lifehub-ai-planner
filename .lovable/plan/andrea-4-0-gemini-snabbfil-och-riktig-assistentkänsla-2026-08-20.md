# Andrea 4.0 — Gemini-snabbfil och riktig assistentkänsla

Målet: Andrea ska svara direkt, hitta rätt sak när du säger den vid namn ("bocka av inlagan till tingsrätten") och agera som appens motor — inte som en allmän chatt.

## Vad som orsakar dagens problem

Verifierat i koden:

- Varje tur skickar **57 verktyg** + hela kalender-/ekonomiunderlaget till modellen, med resonemang på nivå "medium". Det ger många sekunders fördröjning innan första ordet.
- Andrea kan bara bocka av en juristuppgift via `update_case_task`, som kräver ett exakt `task_id`. Det finns **inget sökverktyg** som översätter "inlagan till tingsrätten" till ett id. Står uppgiften inte ordagrant i underlaget låser hon sig eller frågar i cirklar.
- Varje åtgärd kräver manuellt godkännande i chatten, även triviala saker som att kryssa i en ruta.

## Lösningen: två hjärnor med tydlig rollfördelning

```text
Du skriver  ->  Gemini-router (snabb, ~0,5 s)
                 |-- enkel fråga/åtgärd  -> Gemini Flash svarar + kör verktyg direkt
                 `-- komplex/tvetydig    -> ChatGPT-motorn (dagens Andrea) tar över
```

Routern är ett litet, snabbt Gemini-anrop som klassar meddelandet och väljer väg. Du märker bara att svaren kommer direkt.

### 1. Snabbfil på Gemini (`google/gemini-3.7-flash`)

- Hanterar: statusfrågor om dagen/veckan, bocka av uppgifter, lägga till todo/utgift/inköpsvara, navigera i appen, korta uppföljningar.
- Får ett bantat verktygsset (ca 15 verktyg) och ett komprimerat underlag — det är där hastigheten kommer ifrån.
- Inget resonemangssteg, streamar svaret direkt.

### 2. Djupfilen (nuvarande motor, oförändrad modell)

- Hanterar: planering, analys, juristresonemang, filanalys, allt som rör flera steg eller kassaskåpet.
- Behåller resonemangsström och alla 57 verktyg.

## Så blir hon en assistent, inte en chatt

**Namn i stället för id:n.** Nytt verktyg `find_item` som fritextsöker över juristuppgifter, todos, händelser, påminnelser, fasta utgifter och platser och returnerar id + typ. "Bocka av inlagan till tingsrätten" blir då: sök → hitta uppgiften → markera klar → bekräfta. Om flera matchar frågar hon vilken, i stället för att låsa sig.

**Färre godkännanden.** Ofarliga och lätt ångrade åtgärder (bocka av, lägga till todo, registrera utgift, navigera) körs direkt med en "Ångra"-knapp i chatten. Godkännande krävs bara för radering, kassaskåpet, utgående mejl och ekonomiändringar över ett belopp.

**Alltid en åtgärd, aldrig ett dödläge.** Hittar hon inte det du menar svarar hon med de närmaste träffarna som klickbara val i stället för att be dig om ett id.

**Kontextminne.** Hon kommer ihåg vad "den" och "samma" syftar på inom samtalet, så uppföljningar fungerar utan att du upprepar namnet.

## Teknisk sammanfattning

- `src/lib/ai-models.ts`: lägg till `ANDREA_ROUTER_MODEL` och `ANDREA_QUICK_MODEL` (`google/gemini-3.7-flash`). Nuvarande `ANDREA_MODEL` behålls för djupfilen.
- `src/lib/andrea-router.server.ts` (ny): klassificerar turen (snabb/djup) med ett litet Gemini-anrop och strukturerat svar; faller tillbaka på djupfilen vid tveksamhet.
- `src/routes/api/chat.ts`: väljer modell och verktygsset utifrån routerns beslut. Gemini-vägen körs via `@ai-sdk/openai-compatible` mot Lovable AI Gateway, ChatGPT-vägen ligger kvar på Responses API. Samma UI-ström ut, så chattkomponenten behöver inga ändringar i strömhanteringen.
- `src/lib/agent-tools.ts` (ny): delar upp dagens verktyg i `QUICK_TOOLS` och `FULL_TOOLS` så definitionerna inte dupliceras.
- `src/lib/agent.server.ts`: nytt `findItem(userId, query, types)` som söker med `ilike` över de sex tabellerna och rankar träffar; `updateCaseTask` får acceptera titelmatchning som fallback.
- `src/lib/andrea.server.ts`: bantat underlag för snabbfilen (idag + imorgon + öppna uppgifter), fullt underlag för djupfilen.
- `src/components/andrea/Andrea.tsx`: auto-godkännande för verktyg märkta som säkra, "Ångra"-knapp på utförda åtgärder och klickbara flervalsträffar från `find_item`.

## Verifiering innan vi är klara

Jag kör igenom dessa i appen och läser svaren: "bocka av inlagan till tingsrätten", "vad händer imorgon", "lägg till 89 kr cigaretter", en tvetydig fråga som ska landa i djupfilen, och en filuppladdning. Både att rätt väg valdes och att åtgärden faktiskt syns i databasen.

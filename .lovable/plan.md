# AI-trendinsikt per färdsätt

Utöka "Trend per färdsätt" på Platser-sidan med en AI-analys som förklarar *varför* mönstret ändrats för varje färdsätt och ger konkreta åtgärder.

## Så fungerar det

En knapp "Analysera trenden" i trendkortet. När du trycker på den:

1. Appen räknar ut nyckeltal per färdsätt (bil, kollektivt, gång/cykel, okänt) från de senaste 6 månaderna:
   - senaste 4 veckorna jämfört med de 4 veckorna innan, och mot 6-månaderssnittet
   - förändring i sträcka, antal resor och restid, i procent
   - riktning (ökar / minskar / stabil), toppvecka och tystaste vecka
2. Kontext skickas med så förklaringen blir verklig, inte gissad: vilka rutter som är vanligast per färdsätt, om resorna flyttat mellan vardag och helg, och dina sparade färdsättspreferenser.
3. Andrea svarar med ett kort stycke per färdsätt: vad som hänt, sannolik förklaring utifrån datat, och en konkret åtgärd (t.ex. "de fem bilresorna till Jobbet är under 3 km – cykel sparar ca 20 min parkering i veckan").

Varje färdsätt visas som ett eget litet kort under grafen, färgat som linjen i grafen, med en pil upp/ned och procenttalet överst så du ser trenden direkt även utan att läsa texten.

Om det finns för lite data för ett färdsätt (färre än 3 resor totalt) skrivs ingen AI-text för det – istället visas "för få resor för analys".

## Teknisk plan

- `src/lib/travel-trend.ts` (ny): ren beräkningsmodul. Bygger veckobuckets per färdsätt (återanvänder samma `weekStart`-logik som grafen), och exporterar `buildTrendStats(visits)` → per färdsätt `{ mode, trips, km, minutes, deltaKmPct, deltaTripsPct, deltaMinutesPct, direction, topRoutes, weekdayShare, peakWeek, quietWeek }` samt `summarizeTrend(stats, preferences)` som gör en kompakt textrad per färdsätt för prompten.
- `src/lib/travel-insight.functions.ts`: ny server-funktion `getTravelTrendInsight` som tar `{ summary: string }`, anropar `openai/gpt-5.6-sol` på `/v1/responses` med `stream: true` (samma SSE-läsning som befintliga `getTravelInsight`), och returnerar strukturerad text. För att kunna visa en text per färdsätt begär vi strikt JSON via `text.format` json_schema med rot-objekt `{ insights: [{ mode, headline, why, action }] }` – alla fält required, `additionalProperties: false`.
- `src/components/platser/TravelTrendChart.tsx`: lägg till knapp + `useMutation` mot server-funktionen, och rendera insiktskorten under grafen. Beräkningen sker i `useMemo` via `buildTrendStats` så grafen och analysen använder samma data.
- `src/lib/agent.server.ts` + `src/routes/api/chat.ts`: nytt agentverktyg `analyze_travel_trend` så du kan fråga Andrea "varför kör jag mer bil nu?" direkt i chatten. Läser visits + preferenser via service-klienten för din användare och returnerar sammanfattningen.

Inga databasändringar behövs – all data finns redan i `visits` och `travel_preferences`.

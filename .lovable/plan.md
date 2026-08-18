# Pengar: spel, konton och kategorier + Platser per dag

## Pengar

**Nya kategorier**
- "Utlägg juridik" och "Spel" läggs till bland grundkategorierna, väljbara överallt där kategori sätts (snabbinmatning, redigering, kvittotolkning).

**Nya konton**
- "ATG" och "Crypto" skapas som konton med saldo, precis som befintliga konton.

**Kronor per kategori**
- Kortet "Vad pengarna går till" kompletteras med en tydlig lista under diagrammet: varje kategori med summa i kronor och andel i procent, sorterat högst först. Tobak (Cigaretter + Snus) visas både som egna rader och som en sammanlagd tobaksrad, så du ser hela tobakskostnaden för perioden.

**Överföringar mellan konton**
- Ny knapp "Överför" i kontokortet: från-konto, till-konto, belopp, valfri notering. Saldona uppdateras direkt.
- Egen historiklista över alla överföringar (datum, från, till, belopp) med möjlighet att ångra – en ångring för tillbaka pengarna.
- Överföringar räknas inte som utgifter och påverkar därför inte kategoristatistiken.

## Spel (ATG)

- Ny sektion "Spel" under Pengar, kopplad till ATG-kontot.
- Lägg till spel genom att fotografera kupongen: AI:n läser datum, bana, spelform (V75, V86, trippel osv), antal rader och insats. Allt visas som förifyllt formulär du kan rätta innan du sparar.
- Insatsen bokförs automatiskt som en utgift i kategorin "Spel" dragen från ATG-kontot.
- Varje spel har status: oavgjort, förlorat eller vinst. Du fyller i vinstsumman manuellt när loppet är kört – vinsten läggs till på ATG-saldot.
- Sammanfattning: insats, vinst och netto för vald period, plus träffprocent.

## Platser – uppdelat per dag

Platsloggen är i dag en enda lång lista. Den byggs om till en dagsvy:

- Överst en dagsväljare (pilar bakåt/framåt + datum) och en rad kort med de senaste dagarna, där varje dag visar antal stopp, total restid och km.
- Under den: en enda kronologisk tidslinje för den valda dagen, med stopp och resor blandade i rätt ordning – ingen dubblering mellan reselogg, positionshistorik och dagskarta.
- AI:n kör automatiskt dagens tolkning när du öppnar en dag som inte analyserats: platsnamn från Google Places, verkliga sträckor från Google Routes och avstämning mot kalendern.
- AI:n skriver en kort dagssammanfattning överst ("Hemma till 08:10, jobb 09–17, handlade på Ica på vägen hem") och grupperar dagen i block: Hemma, Jobb, Ärenden, Resor.
- Säkra stopp sparas automatiskt; osäkra ligger kvar som förslag med Godkänn/Ignorera och en motivering.
- Den gamla helhetslistan finns kvar som en sökbar historikflik för äldre besök.

## Tekniska detaljer

- Migration: `account_transfers` (from_account_id, to_account_id, amount, note, transferred_at) och `bets` (bet_date, track, game_type, rows, stake, payout, status, receipt_path, raw_ai jsonb) – båda med `user_id`, GRANT till authenticated/service_role, RLS scopad på `auth.uid()` samt updated_at-trigger. Konton ATG och Crypto skapas som datainlägg.
- `src/lib/spend-categories.ts`: nya kategorier "Utlägg juridik" och "Spel"; hjälpare för kategorisummor i kronor inkl. tobaksaggregat.
- `src/components/pengar/SpendPieCard.tsx`: kronlista per kategori under diagrammet.
- Nya komponenter: `pengar/TransferDialog.tsx`, `pengar/TransferHistory.tsx`, `pengar/BetsCard.tsx`, `pengar/BetScanner.tsx` (återanvänder uppladdnings- och bildflödet från `ReceiptScanner.tsx`).
- Ny serverfunktion `readBetSlip` i `finance-ai.server.ts` med samma multimodala mönster som kvittotolkningen; kupongbilden sparas i `ekonomi`-bucketen.
- Överföringar och spelbokföring körs som serverfunktioner i `finance.functions.ts` så saldouppdatering och historikrad sker ihop.
- `src/routes/_authenticated/platser.tsx`: dagsväljare + `DayTimeline`-komponent som slår ihop `DayMap`, `PositionHistory` och `TravelTimeline` för vald dag; `VisitLogList` flyttas till historikfliken.
- `src/lib/day-mapping.server.ts` utökas med dagssammanfattning och blockindelning; automatisk analys när en dag saknar segment.

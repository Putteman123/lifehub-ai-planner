# Resor, topplista och Andrea som agent

Fyra delar: resor mellan platser, topplista på startsidan, tydligare platshantering, och Andrea som kan utföra saker i appen.

## 1. Resa som egen typ i platsloggen

Idag loggas bara besök. Nu läggs "Resa" till som en egen rad mellan två besök.

- När positionen rör sig snabbt (över ca 8 km/h mellan två punkter, eller utanför alla kända platser med tydlig förflyttning) tolkas det som en resa i stället för ett nytt okänt besök.
- En resa får: starttid, sluttid, startplats, slutplats, sträcka i km och snitthastighet.
- Sträckan summeras löpande från GPS-punkterna, inte fågelvägen, så den blir realistisk.
- Korta ryck (under 500 m eller under 3 min) filtreras bort så loggen inte fylls av skräp.
- Reseloggen visar: "07:12 Hemma → 07:48 Jobbet · 22 km · 36 min".
- Dagsvyn och veckostatistiken får en rad "Restid" och "Sträcka" (dag och vecka).

Resor visas med egen färg och tag "Resa" och kan öppnas på kartan precis som besök.

## 2. Topplista på startsidan

Nytt kort på Dashboarden: **Mest besökta platser**.

- Lista över de platser du varit på flest gånger, med antal besök och total tid.
- Växla mellan denna vecka, denna månad och totalt.
- Klick på en rad öppnar Platser-vyn.
- Under listan: total restid och körd sträcka för perioden.

## 3. Redigera och ta bort platser

Knappar för redigera och ta bort finns redan i Platser-vyn. De kompletteras med:

- Bekräftelse innan en plats raderas, med besked om hur många besök som berörs.
- Val vid radering: behåll besöken som okända, eller radera dem också.
- Vid namnbyte på en plats uppdateras etiketten även på tidigare besök.
- Radie och typ går att ändra direkt i listan; besök inom den nya radien kopplas om automatiskt.

## 4. Andrea som riktig agent

Andrea får verktyg för att faktiskt utföra saker, inte bara svara:

- Skapa, ändra och ta bort kalenderhändelser
- Lägga till, bocka av och ta bort uppgifter i Att göra
- Skapa och ändra påminnelser
- Skapa juristärenden och deadlines
- Lägga till barn och barnaktiviteter
- Skapa, döpa om och ta bort platser
- Namnge okända besök och rätta felaktiga resor
- Checka in och ut ("Jag är på jobbet nu")

Så här hålls det tryggt:

- Allt som skapar eller ändrar visas som ett kort i chatten med **Godkänn** / **Avbryt** innan det körs. Läsning och sökning körs direkt utan fråga.
- Radering kräver alltid bekräftelse och namnger exakt vad som tas bort.
- Efter en åtgärd bekräftar Andrea kort vad hon gjorde och vyn uppdateras direkt.

## Tekniskt

- Ny kolumn `kind` på `visits` (`besok` | `resa`), plus `distance_m` och `end_lat`/`end_lng`. Migration med RLS-mönstret som redan används.
- `src/lib/geo.ts`: hastighetsberäkning mellan pings, ackumulerad sträcka, klassificering resa/besök, formatering av km.
- `src/lib/visit-tracking.server.ts`: pings som ligger över hastighetströskeln öppnar/förlänger en reserad i stället för ett besök; när rörelsen stannar inom en plats stängs resan och besöket öppnas.
- `src/lib/places.functions.ts`: nya server-fns för topplista (antal + minuter per plats och period), resestatistik, samt platsredigering med ombindning av besök.
- Nytt dashboardkort `TopPlacesCard` i `src/routes/_authenticated/dashboard.tsx`.
- Andreas verktyg i `src/routes/api/chat.ts` som AI SDK-`tool` med Zod-scheman, körning via `createServerFn` med `requireSupabaseAuth`; muterande verktyg använder `needsApproval` och renderas som godkännandekort i `src/components/andrea/Andrea.tsx`. `stopWhen: stepCountIs(50)`.
- Andreas systemprompt och kontext i `src/lib/andrea.server.ts` utökas med resor, topplista och regler för när hon får agera.

## Steg

1. Migration för resor (typ, sträcka, slutkoordinater)
2. Rese-logik i geo och besöksspårning
3. Reselogg och restidsstatistik i Platser
4. Topplista på Dashboarden
5. Bättre redigering/radering av platser
6. Andreas agentverktyg med godkännandeflöde

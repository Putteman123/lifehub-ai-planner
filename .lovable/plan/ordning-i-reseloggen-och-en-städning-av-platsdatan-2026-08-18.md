# Ordning i reseloggen – och en städning av platsdatan

Jag har tittat i din data och hittat de konkreta orsakerna till att "Dagens reselogg" ser obegriplig ut.

## Vad som är fel i dag

1. **Flera dagar syns under "i dag".** Listan tar med allt som *slutade* i dag, så ett besök som började 17 aug kl 19:58 och slutade 18 aug kl 11:41 dyker upp med gårdagens tid överst.
2. **Dubbletter av platser.** Du har två platser som heter **Hemma** på exakt samma koordinat, samt **Yoump** och **Yuomp** på samma punkt. Loggen hoppar mellan dem, så en lång stund hemma blir uppdelad i flera korta "besök".
3. **Dubbla rader för samma stund.** AI-kartläggningen sparar ibland ett besök som redan finns från telefonen (t.ex. 17 aug 15:28 "Hemma" två gånger, en från `ai` och en från `telefon`).
4. **Meningslösa småposter.** "Okänd plats" i några minuter och resor med 0 m sträcka ligger kvar i listan.
5. **Går inte att rätta.** I dagens logg kan du bara namnge eller markera som resa – inte ändra tid, plats eller radera.

## Vad jag gör

**Dagens reselogg blir en riktig dagsvy**
- Dagsväljare (pilar + datum) så du kan bläddra bakåt, inte bara se i dag.
- Bara den valda dagens tid visas. Ett besök som sträcker sig över midnatt klipps visuellt till dagen och märks "sedan 17 aug 19:58" respektive "pågår".
- Intilliggande poster på samma plats slås ihop i vyn till en rad med total tid (rådata rörs inte).
- Poster kortare än några minuter och 0-meters-resor göms bakom en liten "Visa småposter"-knapp.
- Dagssummering överst: tid hemma/jobb/annat, antal resor, total sträcka.

**Allt går att justera**
- Tryck på en rad → samma redigeringsdialog som i "Alla registrerade besök" (plats, aktivitet, ankomst/avfärd, typ, spara som fast plats, radera). Resor öppnar resedialogen.
- Snabbknappar direkt i raden: redigera, radera (med bekräftelse), namnge okänd plats.
- Nytt: "Slå ihop med föregående" på en rad, så du kan städa upp splittrade besök permanent.

**Städning av befintlig data (engångskörning)**
- Slår ihop de dubbla platserna Hemma och Yoump/Yuomp – besök flyttas till den kvarvarande platsen.
- Slår ihop besök som ligger direkt efter varandra på samma plats till ett sammanhängande besök.
- Tar bort AI-dubbletter som överlappar en redan registrerad post, samt resor på 0 m och besök under 3 minuter som inte är manuella.

**Så att det inte återkommer**
- Positionsloggningen väljer närmaste matchande plats i stället för första träffen, och fortsätter befintligt besök när nästa plats är samma punkt.
- AI-kartläggningen hoppar över segment som krockar tidsmässigt med ett redan sparat besök.
- Platser: varning när du sparar en plats som ligger inom 100 m av en befintlig.

**Övriga buggar**
- Hydreringsvarningen på inloggningssidan (skärmen kan blinka/laddas om vid start) rättas.
- Öppna besök som aldrig stängts (äldre än ett dygn) stängs automatiskt vid nästa position i stället för att ligga kvar som "pågår".

## Tekniskt

- `src/routes/_authenticated/platser.tsx`: dagsvy-state, dagsfilter på överlappande intervall i stället för `left_at >= todayStart`, dagsummering och redigeringsknappar; återanvänder `EditVisitDialog` / `EditTripDialog`.
- Ny `src/lib/day-log.ts` med rena funktioner: klipp besök mot dygn, slå ihop intilliggande poster, filtrera brus – används av både dagsvyn och `VisitLogList`.
- `src/lib/visit-tracking.server.ts`: närmaste-plats-matchning via `matchPlace` i `geo.ts`, stängning av inaktuella öppna besök.
- `src/lib/day-mapping.server.ts`: överlappskoll innan segment sparas som besök.
- Ny serverfunktion `mergeVisits` i `src/lib/places.functions.ts` för manuell sammanslagning av två besök.
- Engångs-SQL-migration för platsdubbletter, överlappande besök och brusposter (inga schemaändringar).
- `src/routes/auth.tsx`: rätta SSR/klient-skillnaden som ger hydreringsvarningen.

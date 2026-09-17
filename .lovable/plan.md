# Platser, rutter och rapporter i vårddelen

Fokus: hemtjänstföretagens adminvy på `/v/f/<kortnamn>`. Din privata LifeHub-app rörs inte.

## 1. Platser – karta och rutter

- **Adress blir plats:** när en brukare sparas med adress hämtas koordinater automatiskt (Google), så alla brukare hamnar rätt på kartan. Knapp för att rätta position manuellt.
- **Ny flik "Karta":** alla brukare som nålar, färgade efter dagens besöksläge (planerat / pågår / klart / obemannat).
- **Dagens rutt per personal:** välj dag och medarbetare, se besöken i tidsordning på kartan med linje mellan stoppen, körsträcka och restid mellan varje besök.
- **Restid räknas in:** schemat varnar när två besök ligger så tätt att resan mellan dem inte hinns med (inte bara när tiderna krockar).
- **Navigera hit:** knapp på varje brukare och besök som öppnar navigering i telefonen.

## 2. Besök som registreras på riktigt

För att timmar och km ska bli sanna behövs faktiska tider:

- Personal kan checka in och ut på ett besök (knapp i besökskortet), med tidpunkt och valfri notering.
- Besöket får status planerat → pågår → utfört / uteblivet.
- Avvikelse kan markeras (t.ex. brukaren ej hemma, besöket kortare än planerat).

## 3. Rapporter

Ny flik "Rapporter" med val av period (vecka, månad, fritt datumintervall) och filter på medarbetare eller brukare:

- Antal besök – planerade, utförda, uteblivna.
- Timmar – planerad tid mot faktisk tid, per medarbetare och per brukare.
- Kilometer – körd sträcka per medarbetare, per dag och totalt för perioden, med restid.
- Punktlighet – hur ofta besöken startar i tid.
- Diagram per vecka och topplistor, samt export till CSV för fakturering och lön.
- AI-sammanfattning: några meningar om periodens mönster, avvikelser och förslag.

## 4. Smart schemaläggning

- **Föreslå schema:** välj dag, tryck "Föreslå fördelning" – systemet fördelar obemannade besök på tillgänglig personal och minimerar körsträckan, med hänsyn till arbetstider, kontinuitet (samma personal hos samma brukare) och restid.
- Förslaget visas som en lista med före/efter: sparad körsträcka och tid. Inget ändras förrän du godkänner.
- **Luckor och överbelastning:** visar vem som är överbokad och var det finns oanvänd tid.
- **Kontinuitet:** varning när en brukare får många olika medarbetare på kort tid.

## Ordning

1. Koordinater + karta + dagsrutt
2. Incheckning/utcheckning och besöksstatus
3. Rapporter med export
4. Smart schemaläggning

## Tekniska detaljer

- Migration: `care_visits` får `checkin_at`, `checkout_at`, `travel_meters`, `travel_seconds`, `deviation`; ny tabell `care_visit_routes` (dag, personal, ordning, sträcka) för sparade dagsrutter. RLS + GRANT enligt befintligt mönster (`can_manage_org`, `is_org_member`).
- Geokodning och ruttberäkning via befintliga `src/lib/google.server.ts` och `maps.functions.ts` (egen Google-nyckel med Lovable-gateway som reserv), resultat cachas per brukare/sträcka för att hålla nere kostnaden.
- Nya serverfunktioner i `src/lib/care-admin.functions.ts`: `geocodeClient`, `getDayRoute`, `checkInVisit`, `checkOutVisit`, `getReports`, `suggestSchedule` – alla med `requireSupabaseAuth` + `requireOrg`.
- Nya rutter: `v.f.$slug.karta.tsx`, `v.f.$slug.rapporter.tsx`; flikarna läggs till i `v.f.$slug.tsx` och visas bara när modulen är aktiverad för kunden.
- Schemaläggningsförslaget körs serverside (närmaste-granne + tidsfönster, restidsmatris från Routes API), med AI-sammanfattning av resultatet.
- Rapporternas CSV genereras i webbläsaren från samma data som visas.

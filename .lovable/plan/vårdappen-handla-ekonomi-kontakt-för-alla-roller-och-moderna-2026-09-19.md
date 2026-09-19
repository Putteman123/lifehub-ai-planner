# Vårdappen: Handla, Ekonomi, kontakt för alla roller och modernare admin

Fyra delar byggs ovanpå befintlig vårddel (Alfa 1.0), alla på samma rollstyrning som idag (admin, personal, brukare, anhörig) och testade i demoföretaget Alfa Demo.

## 1. Handla – inköpslista per brukare

Ny flik "Handla" i vårdmenyn.

- Varje brukare har en egen inköpslista: vara, antal, anteckning, vem som lade till, status.
- Personal bockar av när varan är köpt; anhöriga kan lägga till önskemål och se status.
- Brukaren ser sin egen lista och kan lägga till själv.
- Summering: hur mycket som är köpt, belopp och möjlighet att skriva in kvittobelopp per inköpsrunda.
- Snabbknapp "Handla" direkt i brukarkortet och i besöksvyn.

## 2. Ekonomi – verksamhetens ekonomi

Ny flik "Ekonomi", endast för verksamhetsadmin.

- Nyckeltal: antal utförda besök, timmar, intäkt, personalkostnad, resekostnad och resultat för vald period.
- Timpris per brukare och timkostnad per anställd ställs in i verksamhetens inställningar.
- Tabell per brukare (fakturaunderlag: timmar, belopp, uteblivna besök) och per anställd (arbetade timmar, kostnad, resor).
- Månadsväljare och CSV-export, samma stil som befintliga rapporter.
- Kort trendgraf över resultat per månad.

## 3. Kontakt och chatt för alla roller

- Ny kontaktknapp som finns i hela vårddelen (i sidhuvudet): öppnar en panel med alla personer användaren får kontakta – personal, brukare, anhöriga, kontoret.
- Sökfält, roll-etiketter och bilder; ett klick startar chatt, ett annat startar videosamtal.
- Kontaktknapp även direkt på brukarkortet, personalkortet och i schemat.
- Olästa meddelanden visas som en liten prick på kontaktknappen och i menyn.
- Samtalsvyn förbättras: senaste meddelande, tidpunkt och roll syns i listan.

## 4. Enklare att använda + modernare admin

- Startsida per roll: när man loggar in landar man på det som är relevant (admin = översikt, personal = dagens schema, brukare/anhörig = nästa besök).
- Större knappar, tydligare text och bättre mobilvy i hela vårddelen; alla viktiga åtgärder får ikon plus text.
- Tomma vyer får hjälpsam text i stället för tom yta.
- Adminöversikten byggs om till en modern kontrollpanel: nyckeltal överst, dagens läge (pågående besök, avvikelser, obekräftade uppgifter), snabbåtgärder och en aktivitetslista över det senaste som hänt.
- Andrea får de nya områdena som kunskap ("vad ska handlas till Anna?", "hur ser ekonomin ut denna månad?").

## Teknisk sammanfattning

- Migration: `care_shopping_items` (org, client, titel, antal, notering, status, belopp, created_by/roll, köpt av/när) och `care_org_finance` (timpris per brukare, timkostnad per anställd, reseersättning) samt `care_messages.read_at`-spårning via ny tabell `care_message_reads`. GRANT + RLS per org med befintlig `can_access_care_client` / org-scoping.
- Serverfunktioner: `src/lib/care-shopping.functions.ts` (lista, lägg till, markera köpt, ta bort), `src/lib/care-finance.functions.ts` (nyckeltal, per brukare, per anställd, spara priser), utökning av `care-messages.functions.ts` (`listCareContacts`, `markThreadRead`, olästräknare).
- UI: nya rutter `v.f.$slug.handla.tsx` och `v.f.$slug.ekonomi.tsx`, ny `ContactDrawer.tsx` i `src/components/care/`, uppdaterad `CareChrome`/layout med kontaktknapp och rollstyrd startflik, ombyggd `v.f.$slug.index.tsx` som kontrollpanel.
- Rollstyrning följer `useDemoRole` + serverkontroller; demo-data för inköp och ekonomi läggs in idempotent i Alfa Demo.
- Krav innan klart: `bunx tsgo --noEmit` grönt och build OK.

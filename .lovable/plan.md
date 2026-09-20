# Inkorg och utskick på superadminsidan

En ny sida **Inkorg** i superadminmenyn (bredvid Översikt, Kunder, Samtal) där du läser, svarar på och hanterar allt som kommer in från livo.health — plus ett verktyg för massutskick till potentiella kunder.

## 1. Inkorgen

- Alla intresseanmälningar från livo.health hamnar direkt i inkorgen: avsändare, verksamhet, meddelande, tid.
- Lista med olästa markerade, sökruta och filter (Ny / Pågår / Klar).
- Klicka på en förfrågan för att läsa hela tråden.
- **Svara**-ruta: du skriver svaret i appen, det skickas som mejl från livo.health till personen, och sparas i tråden så du ser vad som sagts.
- Statusknappar: Markera som klar, Återöppna, Ta bort.

## 2. Vidarebefordran till din mejl

Varje ny förfrågan skickas automatiskt vidare till **patrick@mellberg.online** med hela innehållet och en direktlänk till tråden i inkorgen. Svarar du direkt i mejlet går svaret till den som skrev (svarsadressen sätts till personens adress).

Adressen går att ändra på sidan, och vidarebefordran kan slås av/på.

## 3. Massutskick

Ett eget avsnitt "Utskick":

- Välj mottagare: intresseanmälningar från sidan, kontaktpersoner hos befintliga kunder, och/eller en egen lista du klistrar in (namn + mejl).
- Skriv ämne och meddelande, med `{namn}` och `{verksamhet}` som fylls i per mottagare.
- Skicka testutskick till dig själv först.
- Skicka — mejlen går ut ett i taget med livo.health som avsändare, och du ser hur många som gick fram, vilka som hoppades över (avregistrerade) och vilka som misslyckades.
- Alla utskick sparas i en historik, och varje mejl har en avregistreringslänk så det följer reglerna för marknadsföringsmejl.

## 4. Om GoDaddy-mejlen

Riktiga mejl till en GoDaddy-adress kan inte hämtas in i appen direkt. Två vägar, båda fungerar:

- **Enkel väg (rekommenderas nu):** sätt vidarebefordran i GoDaddy till patrick@mellberg.online. Då ser du allt på ett ställe i din vanliga mejl, medan inkorgen i appen hanterar sidans förfrågningar.
- **Full inkorg i appen:** om GoDaddy-mejlen ligger på Microsoft 365 (det gör de oftast) kan jag koppla den brevlådan så att riktiga inkommande mejl visas och besvaras direkt i appens inkorg. Det kräver att du godkänner en anslutning till mejlkontot. Säg till så öppnar jag den kopplingen som ett nästa steg.

## Tekniskt

- Migration: `care_inbox_threads` (källa, avsändare, ämne, status, senast aktiv), `care_inbox_messages` (riktning in/ut, brödtext, tid), `care_campaigns` + `care_campaign_recipients`, `care_inbox_settings` (vidarebefordringsadress, på/av), `care_marketing_contacts` (egen lista + avregistrering). RLS: endast systemägare (`is_app_owner`) läser och skriver; GRANT till authenticated och service_role.
- `submitLead` i `src/lib/care.functions.ts` skapar även en tråd i inkorgen och skickar vidarebefordringsmejlet.
- Nya serverfunktioner `src/lib/care-inbox.functions.ts` (lista, läs, svara, status, inställningar) och `src/lib/care-campaigns.functions.ts` (mottagarurval, testutskick, skicka, historik) — alla med `requireSupabaseAuth` + ägarkontroll.
- Nya mejlmallar `inbox-forward`, `inbox-reply` och `campaign` i `src/lib/email-templates/`, registrerade i `registry.ts`, skickade via befintliga `sendTemplateEmail` (avsändardomän notify.livo.health) med `replyTo` satt.
- Ny rutt `src/routes/_authenticated/v.inkorg.tsx` med flikarna Inkorg och Utskick, plus länk i `v.tsx`.
- Publik avregistreringsrutt `src/routes/api/public/avreg.ts`.

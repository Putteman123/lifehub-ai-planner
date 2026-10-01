# AI-förbrukning under Vård

## Mål
Skapa en ny skrivskyddad sida under Vård, endast för superadmin, som tydligt visar hur många AI-svar som har levererats av Google, ChatGPT, Perplexity och Lovable-reserven.

## Det användaren får
- En ny menypost **AI-förbrukning** i vårdmenyn, synlig endast för superadmin.
- En stor totalsiffra högst upp för antalet registrerade AI-svar under vald period.
- Ett ringdiagram med tydliga, separata färger och procentandel för varje AI-tjänst.
- Antal och procent för **idag**, **denna vecka** och **denna månad**.
- En tydlig kedja som visar faktisk prioritering: Google, ChatGPT, Perplexity och sist Lovable-reserven.
- Senaste uppdateringstid, laddning, tomt läge och begripliga felmeddelanden.
- En Uppdatera-knapp utan några skriv- eller styrfunktioner på själva sidan.

## Registrering av användning
- Lägg till en liten användningslogg som sparar ett lyckat AI-svar först när den slutliga leverantören är känd.
- Registrera leverantör, tidpunkt och typ av AI-funktion, men inte frågor, svar, personuppgifter, API-nycklar eller annan känslig text.
- Koppla registreringen till de gemensamma AI-vägarna för Andrea, vårdfrågor, dagsöversikter och kvittotolkning där leverantören kan fastställas.
- Ett misslyckat försök ska inte räknas som ett levererat svar; endast den tjänst som faktiskt gav slutsvaret räknas.
- Historiken börjar när funktionen införs. Sidan ska uttryckligen visa att äldre användning inte finns registrerad, i stället för att uppskatta eller hitta på siffror.

## Säkerhet
- Serverfunktionen skyddas med inloggning och en strikt kontroll av `is_app_owner(context.userId)` före varje dataläsning.
- Endast exakt `true` ger åtkomst; fel, `false` och tomt svar nekas.
- Menylänken och sidans datafråga aktiveras endast när `getCareContext().isOwner === true`, men serverskyddet är alltid avgörande.
- Databastabellen får minsta nödvändiga rättigheter och RLS; inga breda undantag införs.

## Teknisk utformning
- Ny vårdrutt för AI-förbrukningen enligt samma superadminmönster som GitHub-vyn.
- Ny serverfunktion för aggregerad statistik per dag, vecka och månad.
- Ny tabell för anonymiserade AI-händelser med index för tid och leverantör.
- Gemensam registreringshjälp används av AI-kedjorna så att statistiken inte dupliceras.
- Ringdiagrammet byggs med befintliga gränssnittsmönster och semantiska färgtokens; ingen ny diagramtjänst behövs.

## Verifiering
- Testa att superadmin får statistik och att vanlig användare, `false`, `null` och RPC-fel nekas innan data läses.
- Testa att ett lyckat svar räknas exakt en gång med rätt leverantör och att misslyckade reservförsök inte räknas.
- Testa periodsummering, procentberäkning, tom historik och samtliga fyra leverantörer.
- Kontrollera sidan visuellt i mobilbredd och datorbredd, inklusive ringdiagram, tomt läge och åtkomst nekad.
- Kör fokuserade tester, hela testsviten, typkontroll och byggkontroll.
- Ingen publicering och inga riktiga AI-frågor eller notifieringar skickas som del av arbetet.

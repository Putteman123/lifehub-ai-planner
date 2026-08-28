# Få Andrea stabil och låta henne lära känna Patrick

## Bekräftat nuläge

- Det senaste felet lämnar inga anrop i Lovable AI-loggen. Andreas svar går alltså fortfarande via den direkta Google AI Studio-vägen och når inte den nuvarande reservvägen.
- Reserven är idag `google/gemini-3.7-flash` via Lovable AI, inte Lovables starkaste modell.
- Google- och reservtrafiken är hopkopplade i samma `fetch`-adapter. Det gör att reservvägen inte är en fullständig, oberoende modellkörning med egen API-typ och egen felhantering.
- Andrea har redan en personlig profil (`andrea_profile`), men den är tom och består bara av ett enda anteckningsfält. Det finns inget strukturerat, löpande långtidsminne att söka, uppdatera eller glömma enskilt.

## 1. Hitta och rätta det aktuella felet

- Logga Googles riktiga HTTP-status och säkra feltext server-side innan den generiska chattexten skapas.
- Återskapa frågan som misslyckas genom samma autentiserade `/api/chat`-väg som appen använder.
- Kontrollera särskilt meddelandekonvertering, verktygsscheman och strömstarten, eftersom felet sker innan någon fungerande Lovable-reserv syns i loggarna.
- Visa en konkret svensk feltyp i Andrea-panelen i stället för samma generiska text för alla fel.

## 2. Riktig reserv med Lovables bästa AI

- Behåll den betalda Gemini-anslutningen som förstahandsval.
- Bygg reservanropet separat på Lovable AI Responses API med `openai/gpt-5.6-sol`, full konversationshistorik, samma sidkontext och samma verktyg.
- Aktivera reserv automatiskt när Google inte kan starta svaret eller returnerar ett tjänste-, kvot-, behörighets- eller modellfel. Ett Google-fel ska fortfarande synas i statuskortet så det inte döljs.
- Vid fel efter att ett svar redan börjat strömmas ska Andrea inte dubbelsvara; ”Försök igen” skickar då samma fråga direkt genom Lovable-reserven.
- Följ gatewayens statusregler: inga blinda återförsök vid 400/401/402/403, begränsad väntan endast vid 429/5xx och tydlig kostnads-/blockeringsinformation.
- Propagera Lovables run-id till klienten så varje reservanrop kan verifieras i AI-loggen.

## 3. Löpande personligt långtidsminne

- Skapa en användarskyddad tabell `andrea_memories` för korta, separata minnen med typ, innehåll, säkerhetsgrad, källa, senast bekräftad tid och aktiv/arkiverad status.
- Låt Andrea automatiskt spara stabila fakta och preferenser som Patrick uttryckligen berättar, exempelvis matpreferenser, familjerelationer, återkommande vanor, prioriteringar och hur han vill bli bemött.
- Spara inte lösenord, PIN-koder, juridiska dokumentinnehåll eller andra hemligheter som vanligt minne; sådant stannar i Kassaskåpet respektive rätt datadel.
- Uppdatera eller slå ihop ett befintligt minne i stället för att skapa dubbletter. Tillfälliga kommentarer och rena gissningar sparas inte.
- Hämta ett begränsat antal relevanta aktiva minnen till varje Andrea-anrop, även i snabbfilen, så hennes svar blir personliga utan att prompten växer obegränsat.
- Behåll `andrea_profile` för ton och bemötande; det nya minnet används för fakta och preferenser.

## 4. Insyn och kontroll

- Lägg till en enkel ”Det Andrea minns”-vy i Andrea-panelen där varje minne kan granskas, ändras eller glömmas.
- Stöd naturliga kommandon som ”kom ihåg att …”, ”det där stämmer inte” och ”glöm att …”.
- Visa en diskret bekräftelserad när ett nytt minne sparas eller ett gammalt uppdateras.
- Lägg den nya minnestabellen i kontoöverföringen så minnen följer rätt användare.

## 5. Verifiering

- Testa den nu felande konversationen och frågan ”När kan jag träna 90 min?” genom den riktiga inloggade chatten.
- Tvinga fram ett Google-fel och bekräfta att `openai/gpt-5.6-sol` svarar via Lovable, att ett gateway-logg-id skapas och att verktyget för ledig tid fungerar även i reservläget.
- Berätta en ny stabil preferens, ladda om appen och kontrollera att Andrea använder den i ett senare relevant svar.
- Testa ändra/glöm minne och verifiera att en annan användare aldrig kan läsa det.
- Kontrollera mobilvyn, aktuell build och server-/runtime-loggar innan arbetet markeras klart.

## Tekniska delar

- `src/routes/api/chat.ts`: felspårning, fristående modellreserv, reserv-retry och minnesverktyg.
- `src/lib/google-ai.server.ts`: Google hålls som primär utan att ensam äga reservlogiken.
- `src/lib/ai-gateway.server.ts`: Responses-provider, run-id och streaming för `openai/gpt-5.6-sol`.
- `src/lib/andrea.server.ts`: relevant, begränsad minneskontext.
- `src/lib/agent.server.ts` och `src/lib/account.server.ts`: minnesåtgärder och kontoöverföring.
- `src/components/andrea/Andrea.tsx`: tydliga fel, reservstatus och minneshantering.
- Ny databasändring för `andrea_memories` med uttryckliga behörigheter och radskydd per inloggad användare.

# Ta bort SMS – och nästa steg för LifeHub

## Del 1: Rensa bort SMS-funktionen

SMS-flödet via iOS Genvägar plockas bort helt, så att appen blir enklare och Andrea inte längre har verktyg hon inte kan använda.

Detta tas bort:
- Sidan **SMS** och dess post i den flytande menyn.
- Webhooken som iPhone skickade in meddelanden till.
- Andreas fyra SMS-verktyg (sök, olästa, markera läst, skicka) samt SMS-avsnittet i hennes instruktioner.
- Godkännandekravet för `send_sms` (verktyget finns inte kvar).
- Hjälpfilerna för SMS-logik och serverfunktioner.

Databasen: tabellerna `sms_messages` och `sms_outbox` tas bort i en migration, och hemligheten `SMS_INGEST_TOKEN` kan raderas. Säg till om du hellre vill behålla tabellerna som arkiv – då lämnar jag dem orörda.

### Tekniskt
- Radera `src/routes/_authenticated/sms.tsx`, `src/routes/api/public/sms.ts`, `src/lib/sms.server.ts`, `src/lib/sms.functions.ts`.
- Ta bort SMS-posten i `src/lib/nav-theme.ts`, `send_sms` ur `APPROVAL_TOOL_NAMES` i `src/lib/agent-tools.ts`, verktygsblocket i `src/routes/api/chat.ts` (rad ~329-372) och punkt 7b i `src/lib/andrea.server.ts`.
- `src/routeTree.gen.ts` regenereras automatiskt.
- Migration: `DROP TABLE public.sms_outbox, public.sms_messages;`.

## Del 2: Förslag på förbättringar

Rangordnat efter nytta i din vardag. Välj de du vill ha, så bygger jag dem i tur och ordning.

1. **Andreas morgonbrief** – ett kort överst på startsidan där hon varje morgon sammanfattar dagen: schema, avresetider, dagsbudget, förfallande fakturor och vad som behöver beslutas. Ett klick för att göra om förslagen till todos.
2. **Veckoavstämning på söndagar** – ekonomi mot budget, vad som drog iväg, vilka fasta utgifter som är obetalda och vad nästa vecka kräver. Bygger på data du redan har.
3. **Proaktiva notiser** – push från appen när en faktura förfaller inom 3 dagar, när ett IPTV-konto går ut eller när dagsbudgeten spräckts. Idag måste du själv öppna rätt sida.
4. **Barn- och umgängesvy** – tydlig översikt över veckorna med barnen, aktiviteter och kostnader kopplade till dem, med automatisk hämtning från skol- och sportkalendrar.
5. **Juristärenden med tidslinje** – varje ärende får en tidslinje med händelser, deadlines och dokument från Kassaskåpet/Drive, plus Andreas påminnelser om nästa steg.
6. **Skafferi som föreslår handlingslista** – utifrån förbrukningstakt och prisbok: "det här tar slut i veckan, och det är kampanj på ICA nu".
7. **Kvitto- och dokumentarkiv med sökning** – allt inläst material sökbart i fritext ("hitta bilbesiktningen från i våras") istället för utspritt per modul.
8. **Snabbåtgärder på hemskärmen** – genvägar för de tre vanligaste sakerna (registrera utlägg, lägg till på inköpslistan, prata med Andrea) direkt från iOS.

## Ordning

Först städningen av SMS. Sedan säger du vilket eller vilka nummer ovan du vill börja med.

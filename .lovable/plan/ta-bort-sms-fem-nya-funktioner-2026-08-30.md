# Ta bort SMS + fem nya funktioner

## Del 1: Rensa bort SMS-funktionen

Detta tas bort:
- Sidan **SMS** och dess post i den flytande menyn.
- Webhooken som iPhone skickade in meddelanden till.
- Andreas fyra SMS-verktyg (sök, olästa, markera läst, skicka) samt SMS-avsnittet i hennes instruktioner.
- Hjälpfilerna för SMS-logik och serverfunktioner.
- Tabellerna `sms_messages` och `sms_outbox` samt hemligheten `SMS_INGEST_TOKEN`.

### Tekniskt
- Radera `src/routes/_authenticated/sms.tsx`, `src/routes/api/public/sms.ts`, `src/lib/sms.server.ts`, `src/lib/sms.functions.ts`.
- Ta bort SMS-posten i `src/lib/nav-theme.ts`, `send_sms` ur `APPROVAL_TOOL_NAMES` i `src/lib/agent-tools.ts`, verktygsblocket i `src/routes/api/chat.ts` och punkt 7b i `src/lib/andrea.server.ts`.
- Migration: `DROP TABLE public.sms_outbox, public.sms_messages;`.

## Del 2: Fem nya funktioner

### 1. Veckoavstämning (söndagar)
Nytt kort på startsidan som varje söndag sammanfattar veckan: spenderat mot dagsbudget, största kategorier, avvikelser mot normalt, obetalda fasta utgifter och vad nästa vecka kräver (fakturor, barnveckor, juristdeadlines). Andrea skriver sammanfattningen; du kan göra om punkter till todos med ett klick.

### 2. Proaktiva notiser
Push-notiser från appen (webbpush via PWA på iPhone) när:
- en faktura eller fast utgift förfaller inom 3 dagar,
- ett IPTV-abonnemang går ut inom 7 dagar,
- dagsbudgeten spräcks,
- en kalenderhändelse kräver avresa snart.

Inställningssida där du slår på/av varje typ och väljer tid på dygnet för dagliga påminnelser.

### 3. Barn- och umgängesvy
Bygger ut sidan Barn: veckoschema som visar vilka dagar barnen är hos dig, aktiviteter från deras kalendrar, kostnader kopplade till respektive barn (från utgiftskategorier) och kommande viktiga datum. Enkel växling mellan barn.

### 4. Skafferi som föreslår handlingslista
På Handla: kort som utifrån hur ofta en vara köps räknar ut när den tar slut och föreslår "lägg till nu". Kombineras med prisboken så förslaget visar var det är billigast just nu och flaggar kampanjpris. Ett klick lägger hela förslaget i listan.

### 5. Sökbart dokumentarkiv
Ny sida "Arkiv" som samlar allt inläst material – kvitton, fakturor från mejl, filer i Kassaskåpet och Ekonomi – med fritextsökning ("bilbesiktningen i våras"). Andrea får ett verktyg för att söka i arkivet åt dig i chatten.

## Tekniskt (del 2)

- **Veckoavstämning:** ny serverfunktion som samlar in vecko-data (spend_entries, fixed_expenses/payments, events, case_tasks) och kör en AI-sammanfattning via befintlig `ai-complete.server.ts`. Nytt kort i `dashboard.tsx`, cachas per vecka.
- **Notiser:** ny tabell `notification_prefs` + `notification_log`. Web Push via VAPID-nycklar (lagras som hemligheter), service worker i `public/`, samt en publik cron-route `/api/public/notify` som pg_cron anropar och som beräknar vilka aviseringar som ska ut.
- **Barn:** utökar `children` med schema (varannan vecka/anpassat) i en ny tabell `child_schedule`; ny vy i `barn.tsx` som kombinerar schema, events och spend per barn.
- **Skafferi:** förbrukningstakt räknas ur `pantry_items.times_added` + `last_purchased_at`; nytt kort `RestockCard.tsx` som joinar mot `pantry_prices` för billigaste butik.
- **Arkiv:** ny route `src/routes/_authenticated/arkiv.tsx` som slår ihop `finance_files`, `vault_files` och `mail_findings` i en sökbar vy; sökning på filnamn/caption/summary, samt verktyget `search_archive` för Andrea.

## Ordning

1. SMS-städning (kod + migration).
2. Veckoavstämning.
3. Skafferiets påfyllningsförslag.
4. Barnvyn.
5. Dokumentarkivet.
6. Proaktiva notiser (störst rigg, sist).

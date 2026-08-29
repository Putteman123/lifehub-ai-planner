# SMS för Andrea via iOS Genvägar

iOS låter ingen webbapp läsa Meddelanden direkt. Lösningen är samma princip som platsspårningen redan använder: iPhone skickar in data till LifeHub via en skyddad webhook, och hämtar utgående SMS på samma väg. Andrea får då läsa, söka och förbereda SMS – men varje utgående SMS kräver ditt ja i chatten.

## Så fungerar det

```text
Inkommande:  iPhone-automation "När jag får ett meddelande"
             -> POST /api/public/sms  (hemlig token)
             -> sparas i LifeHub, Andrea kan läsa

Utgående:    Andrea föreslår SMS -> du godkänner i chatten
             -> hamnar i utkorgen
             -> Genväg på iPhone hämtar och skickar via Meddelanden
```

Två genvägar sätts upp på telefonen (steg-för-steg-guide byggs in i appen):
1. **Automation**: "När jag får meddelande" → skicka avsändare, text och tid till LifeHub.
2. **Utkorgs-genväg**: körs manuellt eller på schema (t.ex. var 5:e minut) → hämtar godkända SMS och skickar dem.

Begränsning som är värd att veta: gamla SMS från innan kopplingen finns inte med, och utgående SMS skickas när utkorgs-genvägen kör (nästan direkt om du kör den från låsskärmen/widget).

## Ny sida: SMS

- Lista över inkommande och skickade meddelanden, grupperade per kontakt.
- Sökfält och filter (olästa, senaste veckan).
- Knapp "Nytt SMS" som lägger meddelandet i utkorgen.
- Setup-kort med webhook-adress i klartext och guide för de två genvägarna, likt OwnTracks-guiden i Platser.
- Utkorg som visar status: väntar på godkännande / redo att skickas / skickat.

## Andreas nya verktyg

| Verktyg | Vad hon får göra |
| --- | --- |
| `sms_search` | Söka och läsa inkommande/skickade SMS (fritext, avsändare, datum) |
| `sms_summarize` | Sammanfatta en konversation |
| `send_sms` | Lägga ett SMS i utkorgen – **kräver alltid ditt godkännande** |

`send_sms` läggs i `APPROVAL_TOOL_NAMES` precis som `send_mail`, så inget går ut utan att du sagt ja.

Extra nytta: Andrea kan koppla SMS till resten av appen – t.ex. hitta paketaviseringar, betalpåminnelser eller mötestider i SMS och föreslå todo/kalenderhändelse på samma sätt som mejlskanningen gör idag.

## Tekniskt

- Ny tabell `sms_messages` (riktning, kontakt/nummer, text, tidpunkt, läst-status, extern id för dubblettskydd) och `sms_outbox` (mottagare, text, status: pending/approved/sent, tidsstämplar). RLS + GRANT per ägare enligt projektets mönster.
- Ny publik route `src/routes/api/public/sms.ts` med `POST` (inkommande SMS) och `GET` (hämta godkända utkorgsposter) samt `POST ?ack=` för att markera som skickat. Skyddas av en ny hemlighet `SMS_INGEST_TOKEN`, verifierad med samma timing-säkra jämförelse som `plats.ts`.
- Dubblettskydd på (nummer, tid, text-hash) så att en automation som kör om inte skapar dubbletter.
- Serverfunktioner i `src/lib/sms.functions.ts`: lista, söka, markera läst, skapa utkorgspost, hämta status.
- Andrea-verktygen registreras i `src/lib/agent.server.ts` och `src/routes/api/chat.ts`; `send_sms` läggs till i `src/lib/agent-tools.ts` under `APPROVAL_TOOL_NAMES`.
- Ny route `src/routes/_authenticated/sms.tsx` + post i `FloatingNav.tsx` med egen navfärg och egen `head()`-metadata.

## Ordning

1. Databas + hemlighet `SMS_INGEST_TOKEN`.
2. Webhook (in/ut) och serverfunktioner.
3. SMS-sidan med lista, utkorg och genvägsguide.
4. Andreas verktyg med godkännandeflöde.
5. Koppling till todo/kalender för fakturor och mötestider i SMS.

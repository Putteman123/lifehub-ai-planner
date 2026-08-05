# Apple Hälsa i LifeHub (via Health Auto Export)

Apple Hälsa har inget öppet webb-API. Lösningen: iOS-appen **Health Auto Export** skickar automatiskt din hälsodata till en webhook i LifeHub. Data som hämtas: sömn, träning & steg, puls & återhämtning.

## Så fungerar det

```text
iPhone (Hälsa)  ->  Health Auto Export  ->  https://lifehub-ai-planner.lovable.app/api/public/health
                                              -> sparas i databasen -> Dashboard + Andrea
```

## Vad som byggs

### 1. Databas
Ny tabell `health_metrics`:
- datum, typ (sömn / steg / träning / puls / HRV / vilopuls), värde, enhet, källa, rådata
- unik nyckel på (datum, typ) så att omsända dagar uppdateras i stället för att dubbleras
- RLS på, endast serverkod skriver

### 2. Webhook-endpoint
`src/routes/api/public/health.ts` (POST):
- skyddas med en hemlig token som skickas som header från Health Auto Export
- validerar JSON med Zod, tål Health Auto Exports "metrics"-format
- normaliserar till rader i `health_metrics` och gör upsert
- svarar med antal sparade mätvärden

En hemlig token genereras och sparas som projekthemlighet (`HEALTH_WEBHOOK_TOKEN`).

### 3. Hälsovy i appen
Ny sida `/halsa` i menyn:
- Sömn senaste 14 dagarna (timmar, snitt, trend)
- Steg och träningspass per dag
- Vilopuls och HRV som återhämtningskurva
- "Återhämtningsstatus" i grön/gul/röd, samma språk som kalenderns lediga tid
- Instruktionskort med webhook-URL och token att klistra in i Health Auto Export

### 4. Dashboard
Ett litet hälsokort överst: sömn i natt, steg idag, återhämtningsstatus. Klickbart till `/halsa`.

### 5. Andrea får hälsokontext
`andrea.server.ts` utökas med senaste dagarnas sömn/puls/aktivitet, så hon kan säga saker som:
"Du sov 5h och har juristmöte 18:00 plus Benjamins träning – vill du att jag flyttar något?"
Hon får också väga in återhämtning när hon föreslår mötestider och planerar om dagar.

## Vad du gör i telefonen (engångs)
1. Installera Health Auto Export från App Store.
2. Skapa en automation: REST API, POST, JSON.
3. Klistra in URL och token som visas på sidan `/halsa`.
4. Välj datatyper (sömn, steg, träning, vilopuls, HRV) och intervall (t.ex. varje timme).

## Tekniska detaljer
- Endpoint under `/api/public/*` så att Health Auto Export når den utan inloggning; skyddas i stället av token med timing-säker jämförelse.
- Skrivningar sker med service-role-klient som laddas inuti handlern.
- Migration inkluderar GRANT + RLS enligt projektets mönster.
- Hälsohooks läggs i `src/lib/db.ts` med React Query, vyn använder befintlig `DataGate` för laddning/fel.
- Sidan använder samma designtokens och svenska datumhjälpare som resten av appen.

Jag åtgärdar också ett hydreringsfel på låsskärmen i samma svep.

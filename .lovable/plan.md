# Tre Google-konton i kalendern

I dag är ett Google-konto kopplat till appen. Du vill ha kalendrarna från alla tre: patrick@mellberg.online, registrator@mellberg.online och mellbergpat@gmail.com.

## Så här blir det

1. **Koppla de två nya kontona** – du får två kopplingskort här i chatten, ett i taget. I varje kort väljer du "skapa ny koppling" och loggar in med respektive Google-konto (registrator@mellberg.online och mellbergpat@gmail.com). Det befintliga kontot (patrick@mellberg.online) ligger kvar som det är.

2. **Appen läser alla tre konton** – kalenderdelen byggs om så att den hämtar kalendrar och händelser från alla kopplade konton, inte bara det första:
   - I Inställningar ser du dina Google-kalendrar grupperade per konto, med kontots e-postadress som rubrik, så du ser vilken kalender som tillhör vilket konto.
   - Importera/synka fungerar som i dag, men för alla tre kontona.
   - Händelser du skapar i LifeHub skrivs till rätt konto – det konto som kalendern du valde tillhör.
   - Andreas kalenderverktyg (boka, flytta, läsa dagens schema) läser och skriver i alla tre kontona.

3. **Tydlig märkning** – varje kalender i listan visar vilket konto den kommer från, så du inte råkar lägga privata händelser i fel kalender.

## Tekniskt

- `standard_connectors--connect` anropas två gånger med `google_calendar`; de nya kopplingarna får egna hemligheter (`GOOGLE_CALENDAR_API_KEY_2`, `_3`).
- `src/lib/google.server.ts`: `GOOGLE_CONNECTORS.calendar` utökas till en lista över tillgängliga kalender-nycklar; `googleFetch` tar emot vilken nyckel som ska användas; `listGoogleCalendars`/`fetchGoogleEvents` slår ihop svar från alla konton och returnerar konto-index per kalender.
- `calendars`-tabellen lagrar redan `external_id`; vi lägger till konto-index (t.ex. `external_account` eller kodat i external_id) så skrivningar hamnar i rätt konto. Migrering via Lovable Cloud om ny kolumn behövs.
- `GooglePanel.tsx` grupperar kalendrarna per konto med e-postadress som rubrik (e-post hämtas via varje kontos kalenderlista).
- `syncEventToGoogle`/`removeEventFromGoogle` och Andreas verktyg i `api/chat.ts` använder kalenderns konto vid skrivning.

## Ordning

1. Du kopplar de två nya kontona via korten i chatten.
2. Jag bygger om läsningen (lista + synk) för flera konton.
3. Jag bygger om skrivningen (skapa/ändra/ta bort händelser) så den träffar rätt konto.
4. Test: synka alla tre kontona och skapa en testhändelse i varje.

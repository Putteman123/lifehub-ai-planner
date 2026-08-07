# Ta bort pinkodslåset – appen blir öppen

Appen öppnas direkt utan pinkod eller Face ID. Kassaskåpet behåller sin egen sexsiffriga kod.

## Så fungerar det efteråt

- Du (eller ChatGPT, eller vem som helst med länken) surfar till appen och landar direkt på översikten. Ingen kodruta, ingen väntan.
- Appen loggar i bakgrunden in sig själv som "ägaren", precis som pinkoden gjorde tidigare. Det gör att kalender, ekonomi, IPTV, platser och inköpslista fortsätter fungera exakt som nu — inget behöver byggas om i databasen.
- Sidan `/auth` finns kvar bara som en teknisk mellanlandning och skickar vidare automatiskt; menyns "Lås"-knapp tas bort.
- Kassaskåpet frågar fortfarande efter 181718 / Face ID.

## Viktigt att veta

Med detta blir all din data öppen för vem som helst som känner till adressen: kalender, ekonomi (saldon, löner, utgifter), IPTV-kunder med lösenord, platshistorik och juristärenden. Bara kassaskåpet är skyddat. Vill du senare stänga igen är det en liten ändring att slå på pinkoden igen.

## Tekniska detaljer

- `src/lib/pin.functions.ts`: `unlockWithPin` ersätts av `openApp` — samma engångstoken via `generateLink` mot `APP_OWNER_EMAIL`, men utan pin-jämförelse. `APP_PIN` slutar användas (hemligheten kan ligga kvar).
- `src/routes/auth.tsx`: knappsatsen, Face ID-flödet och felmeddelanden tas bort. Rutten blir en tyst "öppnar…"-vy som kallar `openApp`, sätter sessionen via `verifyOtp` och navigerar till `next` eller `/dashboard`. Detta fixar samtidigt hydreringsvarningen som finns på rutten idag.
- `src/components/AppShell.tsx` och `src/components/FloatingNav.tsx`: `lockApp`/`onLock` och låsknappen tas bort.
- `src/routes/_authenticated/route.tsx` lämnas orörd (integrationsägd) — den gör en tyst omdirigering till `/auth` som nu återvänder direkt.
- `src/lib/login-passkey.functions.ts` och Face ID-registreringen på låsskärmen används inte längre; filen tas bort tillsammans med sina anrop. Kassaskåpets egna passnycklar (`vault.functions.ts`) rörs inte.
- Inga databas- eller RLS-ändringar. Alla `requireSupabaseAuth`-funktioner fortsätter fungera eftersom sessionen finns.

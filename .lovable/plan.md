# Egen iPhone-app för resespårning

Målet: en riktig app på hemskärmen som spårar dina resor i bakgrunden — utan OwnTracks och utan att LifeHub behöver vara öppen. Resorna hamnar ändå i LifeHub som i dag.

## Vad du får

- **Appen "LifeHub Resor"** – en avskalad iPhone-app med tre saker: en stor på/av-knapp för spårning, dagens rutt med tid och sträcka, och en knapp för att skicka in position direkt.
- **Bakgrundsspårning** – appen fortsätter registrera positioner när telefonen är låst eller appen ligger i bakgrunden, och den startar om av sig själv efter omstart av telefonen.
- **Ingen kopiering av adresser** – du loggar in en gång med ditt LifeHub-konto, sedan sköter appen kopplingen själv.
- **Fungerar utan täckning** – positioner sparas i telefonen och skickas när nätet är tillbaka.
- **Batterisnålt** – tre lägen: Sparläge, Balanserat och Detaljerat (tätare punkter när du kör).

## Vad du behöver

Appen måste byggas och installeras via en Mac med Xcode. Jag förbereder allt i projektet och skriver en enkel steg-för-steg-instruktion (öppna projektet i Xcode, välj din telefon, tryck kör). Med ett vanligt gratis Apple-ID måste appen installeras om var sjunde dag; med ett utvecklarkonto (ca 99 USD/år) gäller den i ett år.

Om du inte har Mac: säg till, då bygger jag i stället om OwnTracks-flödet så långt det går i LifeHub.

## Så går arbetet till

1. Paketera projektet som en iOS-app (Capacitor) och lägga till en egen liten startsida bara för spårning.
2. Lägga till bakgrundsposition med rätt behörighetstexter på svenska.
3. Kö och automatisk återsändning av positioner som inte kommit fram.
4. Inloggning i appen med ditt vanliga LifeHub-konto.
5. Låta LifeHub ta emot positionerna från den nya appen på samma sätt som i dag, med källan "telefon".
6. Instruktion för hur du bygger och installerar appen på din iPhone.

## Tekniska detaljer

- Capacitor 7 + `@capacitor/geolocation` för förgrund och `@capacitor-community/background-geolocation` för bakgrund; `ios/` läggs till i repot, `capacitor.config.ts` pekar på den publicerade URL:en för webbdelen så du kan uppdatera utan att bygga om.
- Ny rutt `src/routes/tracker.tsx` (kompakt spårningsvy) som appen laddar som startsida; övriga LifeHub-vyer nås fortfarande.
- Positioner postas till befintlig `src/routes/api/public/plats.ts` i OwnTracks-format (`_type: "location"`, `lat`, `lon`, `acc`, `tst`, `batt`), så `visit-tracking.server.ts`, besöksloggen och dagskartan fungerar oförändrat.
- Autentisering: token hämtas från Supabase-sessionen i webbvyn och nyckeln till ingest-endpointen hämtas via `getIngestInfo`, lagras i Capacitor Preferences — ingen manuell adress.
- Offlinekö i Preferences med exponentiell backoff; batchpost stöds genom att endpointen får acceptera en array av punkter (bakåtkompatibelt med enskilda objekt).
- Info.plist: `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationWhenInUseUsageDescription`, bakgrundsläget `location`.
- Ingen databasmigrering behövs.

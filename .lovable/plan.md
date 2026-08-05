# Livekarta på startsidan + prestandafix

## 1. Knapp med livekarta

Överst på startsidan (Översikt), direkt under rubriken, läggs en tydlig knapp "Var är jag nu" med kartikon.

Vid klick öppnas en kartvy som täcker 80 % av skärmen (80vh, full bredd, rundade hörn, stängkryss):

- Google-karta som centreras på enhetens position.
- Blå pulserande punkt för din position plus en cirkel som visar GPS-noggrannheten.
- Positionen uppdateras löpande i realtid medan vyn är öppen (`watchPosition`), och kartan följer med tills du själv panorerar — då visas en liten "Centrera"-knapp.
- Under kartan: adress för punkten (via Googles adressuppslag), noggrannhet i meter, och länk "Öppna i Google Maps".
- Nekad platsdelning eller GPS-fel visar ett tydligt meddelande med knapp för att försöka igen.

Kartan och positionsspårningen startar först när vyn öppnas, och stoppas när den stängs, så startsidan inte belastas eller drar batteri i onödan.

## 2. Buggar som saktar ner appen

Genomgången av datalagret visar fyra saker som gör appen trög och som åtgärdas:

- **Ingen cache-tid på datafrågor**: varje gång du byter flik eller går tillbaka till en vy hämtas allt om från servern. Sätter en gemensam cache (30 s färskhet, 5 min minne) och stänger av omhämtning vid fönsterfokus.
- **Alla händelser hämtas alltid**: kalenderfrågan hämtar hela historiken utan gräns. Begränsas till ett rullande fönster (bakåt 1 år, framåt 1 år), vilket kraftigt minskar datamängden på mobil.
- **Platsloggen pollar varje minut** på hela översikten även när den inte syns. Sänks till 5 minuter och pausas när fliken ligger i bakgrunden.
- **Onödiga omräkningar på startsidan**: `new Date()` skapas om vid varje rendering, så alla tunga uträkningar (dagsvyer, månadsrutnät, statistik) körs om i onödan. Tidpunkten stabiliseras så uträkningarna bara sker när data faktiskt ändras.

Dessutom rättas ett hydreringsfel på inloggningssidan som gör att sidan renderas om helt en extra gång vid start.

## Tekniskt

- Ny `src/components/LiveLocationCard.tsx` (knapp) + `LiveLocationSheet` som lazy-laddar `GoogleMap` bakom `<ClientOnly>`; `GoogleMap` utökas med stöd för en "self"-markör (cirkelsymbol) och noggrannhetscirkel samt `follow`-läge.
- `navigator.geolocation.watchPosition` med `enableHighAccuracy: true`, rensas i `useEffect`-cleanup.
- Adress via befintlig `reverseGeocode` i `src/lib/maps.functions.ts`, cachad per ~50 m rutnät.
- `src/router.tsx`: `defaultOptions.queries` får `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`, `retry: 1`.
- `src/lib/db.ts`: `useEvents` filtrerar `starts_at` inom ±1 år; `useVisits` `refetchInterval: 300_000` med `refetchIntervalInBackground: false`.
- `src/routes/_authenticated/dashboard.tsx`: `today` via `useState(() => new Date())` (uppdateras vid dagsbyte) i stället för `new Date()` i render.
- `src/routes/auth.tsx`: klientberoende markup (Face ID-tillgänglighet) flyttas bakom hydreringsflagga så SSR och klient matchar.

# Google Maps överallt i appen

Idag ritas alla kartor med OpenStreetMap-inbäddningar och alla avstånd räknas fram med fågelvägen × 1,3. Google Maps är redan kopplat (används bara av Andreas ruttverktyg). Den här ändringen gör Google Maps till motorn för både kartor och avstånd i hela appen.

## Kartor

En ny gemensam kartkomponent (Google Maps JavaScript API, laddad med den befintliga webbläsarnyckeln) ersätter OSM-iframen på tre ställen:

- **Platser → klick på plats/besök** (`MapDialog`): Google-karta med markör, samt länk "Öppna i Google Maps".
- **Namnge okänd plats** (`NameVisitDialog`): samma karta, plus att appen automatiskt föreslår adress/namn för punkten via Googles adressuppslag – du kan godta förslaget med ett tryck eller skriva eget.
- **Resetidslinjen** (`TravelTimeline`): kartan visar hela resan – markör för start och slut och den verkliga körrutten uppritad mellan dem, i stället för bara två punkter. Knappen under kartan leder till vägbeskrivning i Google Maps.

Kartorna laddas först när dialogen öppnas, så startsidan påverkas inte.

## Avstånd och körhistorik

Verkligt vägavstånd och verklig restid från Google ersätter uppskattningen där det går:

- **Redigera resa**: fältet "avstånd" fylls i med Googles körsträcka för vald start/slut och färdsätt. Rutan "avståndet stämmer" jämförs mot Googles siffra i stället för mot uppskattningen. Ändrar du färdsätt räknas sträckan om.
- **Automatisk reseregistrering**: när en resa avslutas hämtas verklig sträcka från Google i stället för fågelvägen × 1,3.
- **Reseplan för nästa vecka**: restider utan historik hämtas från Google (med rätt färdsätt: bil, kollektivt, gång/cykel) i stället för schablon, så avresetider och marginaler blir korrekta. Källan visas som "Google" i stället för "uppskattad".
- **Vanligaste resvägar / trendinsikt**: bygger vidare på samma korrigerade sträckor.

Om Google Maps inte svarar eller inte är kopplat faller allt tillbaka på dagens uppskattning – inget slutar fungera.

## Tekniskt

- Ny `src/components/GoogleMap.tsx`: laddar Maps JS API en gång (`loading=async` + callback, channel-parameter), `google.maps.Marker`, inget `mapId`, `React.lazy` bakom `<ClientOnly>` så SSR inte bryts.
- Ny `src/lib/maps.functions.ts` (serverfunktioner): `routeBetween` (sträcka+tid per färdsätt), `routeMatrixBetween` (batch för veckoplanen) och `reverseGeocode`. Alla anropar gatewayen via befintliga hjälpare i `google.server.ts` (`mapsRoute` utökas med polyline-fält + ny `geocodeLatLng`). 403-hantering enligt connector-riktlinjerna.
- Resultat cachas per koordinatpar i react-query så samma sträcka inte hämtas om och om igen.
- `estimateRouteMeters` blir kvar som fallback; anropsställena (`EditTripDialog`, `travel-plan.ts`, `travel-classify.server.ts`) använder Google först.
- Andreas verktyg `maps_route` återanvänder samma serverfunktion.

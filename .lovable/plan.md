# Egen Google-nyckel + nya kartfunktioner i LifeHub

Idag använder appen Lovables delade kartnyckel, som bara fungerar på lovable.app-adressen. Med din egen nyckel fungerar kartan även på mellberg.online — och vi kan använda fler Google-tjänster.

## Vad du behöver göra först

I Google Cloud (skärmbilderna visar att de flesta står som "Disabled") — slå på:

- Maps JavaScript API (karta i appen)
- Places API (New) (platssök, butiksnamn)
- Geocoding API (adress ↔ koordinater)
- Routes API (rutter + avståndsmatris)
- Street View Static API (gatubilder)
- Maps Static API (små kartbilder i listor/kort)
- Valfritt extra: Maps Elevation, Air Quality, Weather, Pollen, Time Zone

Begränsa nyckeln till webbadresserna `https://mellberg.online/*`, `https://www.mellberg.online/*` och `https://*.lovable.app/*`.

Sedan klistrar du in nyckeln här i chatten, så kopplar jag in den.

## Vad jag bygger

1. **Egen nyckel i hela appen**
   Kartan i webbläsaren och alla serveranrop (rutter, adresser, platser) byter till din nyckel, med Lovables nyckel kvar som reserv om något fattas.

2. **Avståndsmatris ("hur långt kör man")**
   Ny funktion som räknar avstånd och restid mellan flera punkter i ett svep. Används av veckans reseplan och resetidslinjen, som idag räknar en sträcka i taget — blir snabbare och billigare. Nytt kort som visar körd sträcka och tid per resa samt totalt för veckan/månaden.

3. **Street View**
   Gatubild på platser i platshistorik, namngivna platser och kvittobutiker, så du känner igen stället direkt. Visas som en bild i platskortet med knapp för att öppna större.

4. **Navigation**
   "Navigera hit"-knapp på platser och kalenderhändelser med adress: öppnar Google Maps/Waze-navigering på telefonen med rätt startpunkt.

5. **Platssök med förslag**
   Sökfält där du skriver en adress eller ett ställe och får förslag medan du skriver (via appens server, inte direkt från webbläsaren). Används när du namnger en plats, lägger till adress på en händelse eller ett barnschema.

6. **Statisk kartbild i listor**
   Små kartminiatyrer i reselistor och kvitton istället för tung interaktiv karta.

7. **Extra (om du vill)**
   Väder, pollen och luftkvalitet på dagens vy, baserat på din position — bra för planering med barnen.

## Tekniskt

- Ny hemlighet `GOOGLE_MAPS_OWN_KEY` (server) och publik `VITE_GOOGLE_MAPS_BROWSER_KEY` för kartrendering.
- `src/lib/google.server.ts` får ett val: egen nyckel direkt mot Google, annars Lovable-gatewayen.
- Nya serverfunktioner i `src/lib/maps.functions.ts`: `distanceMatrix` (Routes `computeRouteMatrix`), `placeAutocomplete` + `placeDetails` (Places API New), `streetViewUrl`, `staticMapUrl`.
- `src/components/GoogleMap.tsx` läser den egna webbläsarnyckeln först.
- Alla Places-anrop går via servern; inga nycklar med skrivrättigheter i webbläsaren.
- Cache av matris- och geokodningssvar för att hålla nere Google-kostnaden.

## Ordning

1. Koppla in nyckeln och verifiera kartan på mellberg.online
2. Avståndsmatris + navigation
3. Street View + statiska kartbilder
4. Platssök med förslag
5. Väder/pollen/luftkvalitet om du vill ha det

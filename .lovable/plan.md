# Automatisk avståndsberäkning vid redigering av resa

När du byter start- eller slutplats i "Redigera resa" ska appen själv räkna ut hur långt resan är och, om det stämmer med det loggade avståndet, bocka i "Avståndet stämmer" automatiskt.

## Så fungerar det

- Så snart både start och slut har en position (vald plats eller resans egen GPS-punkt) beräknas ett förväntat avstånd: fågelvägen mellan punkterna multiplicerat med en vägfaktor på 1,3 (verkliga vägar är längre än fågelvägen).
- Fältet "Avstånd (km)" fylls i automatiskt med det beräknade värdet när du ändrar start eller slut. Du kan alltid skriva över det manuellt – då slutar automatiken skriva över din siffra.
- Under fältet visas en rad: "Beräknat: 12,4 km (fågelväg 9,5 km)" med en liten knapp "Använd beräknat" om du vill återgå.
- Kryssrutan "Avståndet stämmer" sätts automatiskt i när det inskrivna avståndet ligger inom 15 % (eller 500 m) av det beräknade – i listan visas resan då med grön markering. Ligger värdena längre isär bockas den ur och en gul varning visas: "Avviker från beräknat avstånd".
- Du kan fortfarande manuellt bocka i eller ur rutan; ditt val vinner över automatiken.

## Teknisk beskrivning

- Ny hjälpfunktion i `src/lib/geo.ts`: `estimateRouteMeters(aLat, aLng, bLat, bLng)` = `haversineMeters * 1.3`, samt `distanceMatches(actual, estimate)` som returnerar true vid avvikelse < 15 % eller < 500 m.
- `src/components/platser/EditTripDialog.tsx`:
  - Härled aktuella start-/slutkoordinater från `startPlace`/`endPlace` (annars `trip.lat/lng` och `trip.end_lat/end_lng`).
  - `useEffect` på koordinatparet: sätt `km` till beräknat värde om användaren inte redigerat fältet manuellt (`kmTouched`-state), och uppdatera `verified` via `distanceMatches` om användaren inte manuellt rört kryssrutan (`verifiedTouched`-state).
  - Rendera hjälptext med beräknat/fågelväg-värde, knappen "Använd beräknat" (nollställer `kmTouched`) och avvikelsevarning.
  - Sparlogiken är oförändrad; `distance_m` och `distance_verified` skickas som idag.
- Inga databasändringar behövs – `distance_verified` finns redan i `visits`.

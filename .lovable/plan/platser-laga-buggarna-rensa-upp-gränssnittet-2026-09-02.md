# Platser: laga buggarna + rensa upp gränssnittet

Jag har kollat databasen och koden. Platser är inte trasig på ytan – det är datan och strukturen som spårat ur.

## Vad som faktiskt är fel (verifierat)

- **Två besök ligger "pågående" samtidigt.** Ett besök från 31 augusti kl 08:06 har aldrig stängts, och dagens post är också öppen. Koden tittar bara på det *senaste* besöket, så äldre öppna poster blir kvar för alltid. "Jag går nu" stänger också bara det senaste.
- **En påhittad resa i dag: "Hemma → Hemma", 0 meter.** Den ligger öppen och räknas in i dagens statistik. Nollresor rensas bara när en ny position kommer in – kommer ingen, ligger de kvar.
- **Telefonen har inte skickat något sedan 31 augusti kl 08:06.** Enda positionerna de senaste dygnen är två manuella "Jag är här". Ingenstans i appen syns att inflödet dött, så sidan ser bara tom och trasig ut.
- **Dagskartläggningen har inte körts sedan 1 september** – den kräver ett manuellt knapptryck.

## Vad jag gör åt det

**Buggfixar**
- Stäng alla öppna besök, inte bara det senaste, både vid ny position och vid "Jag går nu".
- Automatisk stängning av besök som legat öppna för länge (utan att vänta på nästa position) – görs när sidan laddas.
- Resor utan sträcka (0 m) eller med samma start och mål skapas inte, och befintliga skräpposter rensas bort.
- Engångsstädning av dagens felaktiga "Hemma → Hemma" och det hängande besöket från 31 augusti.
- Dagskartläggningen körs automatiskt när du öppnar Platser, om dagen inte redan är analyserad.

**Statusrad högst upp på Platser**
En rad som direkt svarar på "funkar det?": senaste mottagna position (tid + källa), om telefonen är tyst mer än 6 timmar visas en tydlig varning med länk till OwnTracks-guiden, samt om något besök pågår just nu.

## Uppstädning av gränssnittet

Platser är i dag 12 kort staplade på varandra i en enda lång kolumn. Sidan delas upp i fyra flikar:

1. **I dag** – statusrad, karta över dagen, en enda kronologisk tidslinje med stopp och resor (dagens reselogg, positionshistorik och dagslogg slås ihop – i dag visas samma sak tre gånger).
2. **Statistik** – tid per platstyp, färdsätt, trendgraf, vanligaste resvägar, veckans reseplan.
3. **Platser** – sparade platser och hela besökshistoriken i en sökbar lista.
4. **Inställningar** – live-läge, OwnTracks-guide med adressen, rensa historik.

Samma upplägg som Pengar redan har, så appen känns konsekvent.

**Övergripande i appen**
- Samma kortstil, rubrikstorlekar och avstånd överallt (flera sidor har egna varianter i dag).
- Sidor med många kort får samma flikmönster och en tydlig "viktigast först"-ordning.
- Tomma lägen får en kort förklarande text i stället för tomma kort.

## Tekniskt

- `src/lib/visit-tracking.server.ts`: stäng alla öppna besök, tidsstyrd auto-stängning, blockera nollresor.
- `src/lib/places.functions.ts`: ny `placesStatus` (senaste ping, källa, öppet besök) + städfunktion som körs vid sidladdning.
- `src/routes/_authenticated/platser.tsx`: delas upp i fyra flikkomponenter under `src/components/platser/`; befintliga kort flyttas in oförändrade där de hör hemma.
- Ingen databasmigrering behövs; de felaktiga raderna rensas av städfunktionen.

# Lyft för kalendern + fräschare app

## Vad du får
1. **Dagsvy med timmar** – dygnet visas som en tidslinje 00–24 (automatiskt scrollad till nu/första händelse), med en tydlig "nu"-linje. Händelser ritas som brickor i rätt höjd efter hur länge de pågår; krockar läggs sida vid sida. Tryck på en tom timme för att skapa en ny händelse där.
2. **Tydligare brickor** – varje bricka får färg efter kategori, ikon (möte, pass, resa, ärende, privat), tid, plats och en rad "att göra". I vecka/månad blir brickorna större och lättare att läsa på mobilen.
3. **Smart dag med AI (din Google-nyckel)** – överst i dagsvyn en ruta "Din dag i korthet":
   - 2–3 meningars sammanfattning av dagen
   - Viktigast att hinna, luckor för fokus/paus, restider mellan platser och varningar (krockar, för tight schema)
   - Knapp "Uppdatera" och märkningen "Via din Google-nyckel / Lovable (reserv)"
   - Sparas per dag så den inte kostar något vid varje öppning; uppdateras när händelser ändras.
4. **Fräschare app** – mjukare kort, luftigare avstånd, tydligare rubriker och flikar, jämnare färger i kalender, översikt och meny (samma färgtema och logga som nu).
5. **Ingen hjärt-animation vid start** – appen öppnas direkt.

## Tekniska detaljer
- `src/routes/_authenticated/kalender.tsx`: ny `DayView` som timgrid (64 px/timme, absolut positionerade brickor, överlappskolumner, nu-indikator, klick på tom timme → `open(null, datum+timme)`); ny `EventCard`-bricka som ersätter `EventChip` och listraden; ikon via kategori/`shiftMeta`.
- Ny server-funktion `src/lib/day-brief.functions.ts` (requireSupabaseAuth) som hämtar dagens händelser + uppgifter och anropar `completeTextDetailed` (Google först, Lovable sist) med JSON-svar {summary, priorities[], gaps[], warnings[]}; returnerar `provider`.
- Cache i tabell `day_briefs` (user_id, date, hash av händelser, payload) med GRANT + RLS på egna rader; ny brief bara när hashen ändras eller vid "Uppdatera".
- Ny komponent `src/components/calendar/DayBriefCard.tsx`.
- Visuell uppfräschning via tokens i `src/styles.css` (radie, skuggor, ytor) + mindre justeringar i kort/flikar – inga hårdkodade färger.
- Ta bort `<IntroSplash />` från `src/routes/__root.tsx` och radera `src/components/IntroSplash.tsx`.

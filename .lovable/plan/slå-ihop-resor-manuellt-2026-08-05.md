# Slå ihop resor manuellt

## Vad som finns i dag
På Platser finns redan en automatisk knapp "Slå ihop X resor till en", men den fungerar bara på dagens reselogg och slår ihop hela den längsta serien av resor i följd — du kan inte välja själv vilka poster som ska bli en.

## Vad som byggs
Fri markering av poster i tidslinjen "Reskarta & tidslinje" (senaste 90 dagarna):

- Ett läge "Slå ihop" som visar en kryssruta på varje rese-post.
- Markera två eller flera resor (även från olika dagar) och tryck "Slå ihop 2 resor".
- Bekräftelseruta som visar vad resultatet blir: starttid från första resan, sluttid från sista, summerad sträcka och total tid.
- Efter sammanslagning: en post kvar, övriga tas bort, listan uppdateras direkt och en bekräftelse visas med total sträcka och tid.
- Den sammanslagna resan går att redigera som vanligt (start, mål, tagg, färdsätt) via pennan.

Den befintliga snabbknappen på dagens reselogg blir kvar som genväg.

## Teknisk detalj
- Återanvänder befintliga `mergeVisitTravels` (serverfunktion) och `mergeTravelVisits` i `travel-classify.server.ts` — ingen databasändring behövs.
- `src/components/platser/TravelTimeline.tsx`: nytt lokalt urvalsläge (`Set<string>` av visit-id), kryssrutor i listan, sammanslagningsknapp i sektionsrubriken, `useServerFn(mergeVisitTravels)` + `qc.invalidateQueries(["visits"])`.
- Bekräftelsen görs med en enkel `AlertDialog` från shadcn med sammanfattning beräknad lokalt från valda poster.

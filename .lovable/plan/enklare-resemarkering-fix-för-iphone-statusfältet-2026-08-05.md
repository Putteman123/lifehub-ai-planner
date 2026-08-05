# Enklare resemarkering + fix för iPhone-statusfältet

## 1. Ett tryck: "Det här är en resa"

I dagens reselogg (och i tidslinjen) får varje besök som inte redan är taggat som resa en liten knapp **"Resa"**. När du trycker på den:

- Besöket byter typ till resa direkt (optimistiskt, ingen dialog).
- Andrea gör resten automatiskt i bakgrunden:
  - gissar start- och slutplats utifrån föregående/efterföljande besök och sparade platser,
  - beräknar avstånd med den befintliga ruttberäkningen och bockar i "avståndet stämmer" om det är rimligt,
  - gissar färdsätt (bil / kollektivt / gång-cykel) utifrån hastighet, sträcka och din sparade preferens för den rutten,
  - loggar ändringen i resans historik.
- En liten toast visar vad AI:n satte, med "Ångra" och "Justera" (öppnar befintlig redigeringsdialog).

Om flera besök är markerade i rad (som dina fyra) kan du trycka på var och en – eller använda knappen "Slå ihop till en resa" som visas när intilliggande besök markerats som resor inom kort tid: de slås då ihop till en resa med rätt total sträcka och tid.

## 2. Mer AI i vardagen

- Andrea får ett nytt verktyg `mark_as_travel` så du även kan säga "de fyra sista är en resa hem" och hon fixar det.
- Efter en automatisk klassning föreslår Andrea att spara den som återkommande regel ("resor mellan Jobb och Hem = bil") så framtida besök taggas automatiskt.

## 3. iPhone: innehåll hamnar under klockan

Appen körs helskärm på hemskärmen (`viewport-fit=cover` + genomskinligt statusfält), men toppen saknar utrymme för statusfältet.

- Sidhuvudet i AppShell får `padding-top` som följer `safe-area-inset-top`, så titel och knappar alltid ligger under klockan.
- Den flytande vänstermenyn och Andrea-panelen får samma skydd i topp/botten.
- En diskret bakgrundslist bakom statusfältet så att innehåll som scrollar förbi inte krockar med klockan.

## Teknisk sammanfattning

- Ny serverfunktion `markVisitAsTravel` i `src/lib/places.functions.ts` som sätter `entry_kind='resa'`, kör AI-/heuristikklassning (återanvänder `estimateRouteMeters`, `route-key.ts`, `travel_preferences`) och skriver `visit_edits`.
- Ny funktion `mergeTravelVisits` för att slå ihop intilliggande reseposter.
- UI: knapp i `src/routes/_authenticated/platser.tsx` och `TravelTimeline.tsx`, toast med ångra.
- Nytt agentverktyg i `src/lib/agent.server.ts`.
- Safe-area-fix i `src/components/AppShell.tsx` och `src/components/FloatingNav.tsx`.

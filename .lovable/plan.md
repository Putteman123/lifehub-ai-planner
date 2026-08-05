# Reseplan för nästa vecka

Koppla reseinsikten till kalendern så Andrea inte bara sammanfattar historiken, utan säger hur du bör ta dig till nästa veckas aktiviteter och när du behöver åka.

## Vad du får

Ett nytt kort på Platser-sidan: **"Reseplan nästa vecka"**.

- Listar dina kommande aktiviteter de närmaste 7 dagarna som har en plats.
- För varje aktivitet: föreslaget färdsätt (bil, kollektivt, gång/cykel), uppskattad restid, rekommenderad avresetid och en restidsmarginal.
- Markerar tajta byten där två aktiviteter ligger så nära i tid att resan inte hinns med.
- En kort AI-text från Andrea överst som sammanfattar veckan: vilket färdsätt som dominerar, var det blir stressigt och vad du kan justera.

Exempel:
```text
Tis 11 aug
Juristmöte 18:00 · Tingsrätten
Bil · ca 22 min · åk 17:30 (8 min marginal)

Ons 12 aug
Benjamin fotboll 17:30 · Idrottsplatsen
Krockar med Jobb till 17:00 – bara 8 min restid tillgängligt
```

## Hur förslagen räknas fram

Beräkningen bygger på data du redan har i appen, inte gissningar:

1. **Startpunkt** — föregående aktivitets plats samma dag, annars din vanligaste plats den tiden på dygnet (hem/jobb enligt besökshistoriken).
2. **Slutpunkt** — matchar aktivitetens plats mot dina sparade platser (namn eller adress). Aktiviteter utan matchbar plats hoppas över.
3. **Restid** — historiskt snitt för samma rutt när det finns (samma logik som "Mina vanligaste resvägar"), annars uppskattat avstånd × typisk hastighet per färdsätt.
4. **Färdsätt** — ditt sparade preferens för rutten eller veckodagen vinner. Saknas preferens väljs det färdsätt du oftast använt på liknande sträcka; korta sträckor föreslår gång/cykel.
5. **Marginal** — grön om du har god tid, gul om marginalen är knapp, röd om resan inte hinns med.

## Teknisk plan

- `src/lib/travel-plan.ts` (klient-säker, ren logik): matchning av event mot `places`, val av färdsätt via `travel_preferences` + historiska `visits`, restidsestimat via `estimateRouteMeters`/`route-key`, samt marginalklassning. Returnerar en typad `TravelPlanItem[]`.
- `src/lib/travel-insight.functions.ts`: ny serverfunktion `getWeeklyTravelPlanInsight` som tar den färdiga planen (komprimerad, ingen rådata) och streamar en kort svensk sammanfattning från `openai/gpt-5.6-sol` via Responses API — samma mönster som befintliga `getTravelInsight`.
- `src/components/platser/WeeklyTravelPlan.tsx`: nytt kort som använder `useEvents`, `usePlaces`, `useVisits` och `travel_preferences`, renderar listan per dag och knappen "Fråga Andrea".
- `src/routes/_authenticated/platser.tsx`: rendera kortet ovanför `TravelModeStats`.
- `src/lib/agent.server.ts` + `src/routes/api/chat.ts`: nytt verktyg `plan_week_travel` så du kan fråga Andrea "hur tar jag mig runt nästa vecka?" direkt i chatten och få samma svar.

Inga databasändringar behövs.

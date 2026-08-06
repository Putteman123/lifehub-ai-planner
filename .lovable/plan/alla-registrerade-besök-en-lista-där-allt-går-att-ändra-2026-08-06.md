# Alla registrerade besök – en lista där allt går att ändra

En ny sektion på sidan **Platser**: en komplett logg över varje registrerat besök (även okända GPS-punkter), med möjlighet att redigera direkt.

## Vad du får

**Listan**
- Alla besök, nyaste först, grupperade per dag med datumrubrik.
- Varje rad visar: färgprick/typ, plats (eller "Okänd plats"), aktivitet/anteckning, ankomst–avfärd, längd, och märke om det är en resa (sträcka + färdsätt).
- Filter: tidsintervall (7 dagar / 30 dagar / allt) och en knapp "Visa bara okända" så du snabbt kan namnge det som saknar plats.
- Sökfält på namn/anteckning.
- Ladda fler-knapp så långa loggar inte gör sidan tung.

**Redigera ett besök**
Tryck på en rad → dialog där du kan ändra:
- Plats: välj bland dina sparade platser, eller skriv ett fritt namn
- Aktivitet/anteckning
- Ankomsttid och avfärdstid (om du ändrar tider räknas längden om)
- Typ (jobb, jurist, hem, barn, annat)
- Markera som resa/besök
- Spara som fast plats (kopplar även tidigare besök i närheten, som idag)
- Radera besök

Resor öppnar den befintliga resedialogen med sträcka, färdsätt och start/slut, så inget dubbelarbete.

**Snabbåtgärder direkt i raden**
Namnge (för okända), redigera, radera – med bekräftelse innan radering.

## Tekniskt

- Ny komponent `src/components/platser/VisitLogList.tsx` (lista, filter, gruppering per dag) och `src/components/platser/EditVisitDialog.tsx` (redigeringsformulär).
- Använder befintliga `useVisits`, `useUpsertRow("visits")`, `useDeleteRow("visits")` från `src/lib/db.ts` – inga nya server-fns behövs för vanlig redigering.
- "Spara som fast plats" återanvänder befintlig `nameVisit` i `src/lib/places.functions.ts`.
- Resor delegeras till befintliga `EditTripDialog`.
- Tider hanteras via `datetime-local` i Europe/Stockholm enligt `src/lib/tz.ts`-mönstret.
- `platser.tsx` får en ny sektion "Alla registrerade besök" under "Mina platser"; `useVisits` hämtar längre historik när filtret utökas.
- Inga databasändringar.

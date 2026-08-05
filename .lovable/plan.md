# Namnge okända platser

Idag visas besök utan matchad plats som "Okänd plats" och klick öppnar bara kartan. Du ska istället kunna sätta namn och aktivitet direkt, t.ex. "Handlar", "Skola Philip", "Skola Benjamin".

## Så fungerar det

- Klick på ett besök i reseloggen öppnar kartdialogen som idag, men den får ett nytt fält: **Namnge plats**.
- För okända besök visas dialogen direkt i "namnge"-läge med:
  - Namn på platsen (fritext, t.ex. "ICA Maxi")
  - Vad du gör där (fritext med snabbval: Handlar, Skola Philip, Skola Benjamin, Träning, Jobb, Jurist, Hem)
  - Typ av plats (Jobb / Jurist / Hem / Barn / Annat)
  - Kryssruta: "Spara som fast plats" (förvald på när besöket har koordinater)
- Sparar du utan fast plats sätts bara namn och anteckning på det enskilda besöket.
- Sparar du som fast plats skapas platsen med besökets koordinater och standardradie, besöket kopplas till den, och **alla tidigare okända besök inom radien kopplas också automatiskt** — så historiken blir rätt bakåt.
- Framtida incheckningar på samma koordinater matchar platsen automatiskt (befintlig matchningslogik).
- Snabbvalen för aktivitet återanvänder tidigare använda anteckningar så listan växer med din användning.

## Teknisk del

- Ny komponent `src/components/platser/NameVisitDialog.tsx` (formulär + snabbval).
- `src/routes/_authenticated/platser.tsx`: klick på okänt besök öppnar den nya dialogen (kartan visas som liten förhandsvy i samma dialog via befintlig OpenStreetMap-iframe); känt besök beter sig som idag.
- Ny server-funktion i `src/lib/places.functions.ts`: `nameVisit({ visitId, label, note, kind, saveAsPlace })` som uppdaterar `visits.label`/`note`, valfritt skapar rad i `places` och bakåtkopplar matchande besök (haversine mot radie) med `matchPlace`-logiken i `src/lib/geo.ts`.
- Ingen schemaändring behövs: `visits.label`, `visits.note`, `visits.place_id` och `places` finns redan.
- Efter sparande invalideras `visits`- och `places`-queries så dashboard och statistik uppdateras.

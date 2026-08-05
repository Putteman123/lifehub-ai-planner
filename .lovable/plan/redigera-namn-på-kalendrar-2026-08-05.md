# Redigera namn på kalendrar

Idag går en kalender bara att lägga till, synka eller ta bort. Namnet som följer med från källan (t.ex. "hopp Piva") går inte att ändra utan att radera och lägga till kalendern på nytt.

## Vad som byggs

På sidan **Kalendrar** får varje kalenderkort en pennikon bredvid synk- och papperskorgsknappen.

Klick på pennan öppnar samma dialog som "Lägg till kalender", men i redigeringsläge:

- **Namn** – fritt redigerbart, förifyllt med nuvarande namn (t.ex. ändra "hopp Piva" till "Jobb Piva").
- **Färg/kategori** – går att byta samtidigt, förifylld med kalenderns nuvarande färg.
- **Länk (ICS/webcal)** – visas men är låst, eftersom byte av länk motsvarar en ny kalender.
- Knappen heter "Spara" istället för "Lägg till", och dialogens rubrik blir "Redigera kalender".

Namnbytet påverkar bara etiketten i appen – befintliga händelser, synkinställningar och synkhistorik behålls, och nästa automatiska synk skriver inte över det egna namnet.

Namnet uppdateras direkt i kalenderlistan och överallt där kalendernamnet visas.

## Tekniskt

- `src/routes/_authenticated/kalendrar.tsx`: dialogen får ett `editingId`-läge. Vid spara anropas befintliga `useUpsertRow("calendars")` med `{ id, name, color }` så raden uppdateras istället för att skapas.
- Ingen databasändring behövs – `calendars.name` finns redan och RLS-policyn tillåter uppdatering av egna rader.
- Kontroll görs att synkfunktionen (`src/lib/calendar-sync.functions.ts`) inte skriver tillbaka källans namn vid synk; om den gör det tas den skrivningen bort så det egna namnet består.

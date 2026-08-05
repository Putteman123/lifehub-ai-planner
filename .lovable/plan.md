# Karta för besökta platser + Att göra-lista

## 1. Klickbara platser med karta

I Platser-vyn blir både sparade platser och rader i besöksloggen klickbara. Ett klick öppnar en kartruta som visar exakt var besöket skedde.

- Ny komponent `MapDialog`: dialog med rubrik (platsnamn + tid/varaktighet) och en inbäddad karta centrerad på koordinaten med markör.
- Kartan använder OpenStreetMap-inbäddning — ingen API-nyckel eller konto behövs, fungerar direkt.
- Besök utan koordinater (manuella incheckningar utan GPS) faller tillbaka på den kopplade platsens koordinater; saknas båda visas "Ingen position registrerad" istället för en tom karta.
- Länk "Öppna i kartor" under kartan för navigering i telefonens kartapp.

## 2. Att göra

Ny egen vy "Att göra" i den flytande menyn (separat från juristuppgifterna).

- Lägg till uppgift: titel (krav), anteckning (valfri), sista datum (valfritt — tomt fält är helt okej).
- Aktiv lista sorterad med närmaste sista datum först, uppgifter utan datum sist. Förfallna datum markeras i rött, "idag"/"imorgon" i varningsfärg.
- Bocka av en uppgift → den flyttas direkt till Arkiv, med datum för när den blev klar.
- Arkiv visas i egen flik/sektion, med möjlighet att återaktivera eller ta bort permanent.
- Redigera och ta bort aktiva uppgifter.

Dashboardens "Deadlines"-kort kompletteras med de att göra-uppgifter som har sista datum, så allt syns på startsidan.

## Teknisk del

- Migration: ny tabell `public.todos` (`user_id`, `title`, `notes`, `due_date` nullable, `is_done` default false, `completed_at` nullable, timestamps + updated_at-trigger). GRANT till `authenticated`/`service_role`, RLS med policy scopad på `auth.uid()`, i linje med övriga tabeller.
- `src/lib/db.ts`: `useTodos()` samt `"todos"` tillagt i `TableName`/`QUERY_KEY` så befintliga `useUpsertRow`/`useDeleteRow` kan återanvändas.
- Ny route `src/routes/_authenticated/attgora.tsx` med egen `head()`-metadata; ny post i `src/components/FloatingNav.tsx` (ikon `ListTodo`).
- Ny komponent `src/components/platser/MapDialog.tsx`; `platser.tsx` gör plats- och besöksrader till knappar som öppnar dialogen (radera-knappar behåller sin egen klickhantering).
- Andreas kontext (`andrea.server.ts`) utökas med öppna att göra-uppgifter så hon kan påminna om dem.

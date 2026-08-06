# Egna kategorier i kalendern

Idag är kategorilistan (Heltidsjobb, Ledig, Jurist, Barn, Privat, Viktigt) fast inbyggd. Efter den här ändringen kan du lägga till egna kategorier direkt i samma dropdown, och de dyker upp överallt där kategorier används.

## Så fungerar det

- Längst ned i kategorilistan finns valet **"+ Ny kategori…"**.
- Du skriver namnet, trycker Spara, och den nya kategorin väljs direkt för händelsen.
- Appen tilldelar automatiskt en färg ur befintliga paletten (nästa lediga färg i turordning), så den syns tydligt i kalender, chips och färgmarkeringar.
- Egna kategorier kan döpas om och tas bort. Tas en kategori bort flyttas dess händelser till "Privat".
- De inbyggda kategorierna går inte att radera (de används av AI-förslag och skiftlogik), men de ligger kvar oförändrade.

## Var det syns

- Händelsedialogen (skapa/redigera aktivitet)
- Kalenderns färgkodning och filter
- Kategori-etiketter på översikten och i påminnelser
- Andrea känner igen de egna kategorierna när hon skapar eller ändrar händelser

## Teknisk plan

1. **Databas (migration)**
   - `events.category` byter typ från enum `event_category` till `text` med bevarade värden, så egna värden kan sparas. Enumtypen behålls inte längre som kolumntyp.
   - Ny tabell `event_categories`: `user_id`, `value` (slug, unik per användare), `label`, `color_token`, `sort_order`, tidsstämplar. GRANT till `authenticated` + `service_role`, RLS med `auth.uid() = user_id`, `updated_at`-trigger.
2. **`src/lib/categories.ts`**
   - `CATEGORIES` blir bas-lista; ny funktion som slår ihop bas + användarens rader till en enhetlig lista.
   - `categoryMeta()` klarar okända värden med fallback och dynamisk färg via inline CSS-variabel i stället för fast Tailwind-klass för egna kategorier.
3. **Ny hook `useCategories()`** (React Query mot `event_categories`) plus mutationer för skapa/döpa om/ta bort (borttagning uppdaterar berörda events till `privat`).
4. **`EventDialog.tsx`**: dropdown renderar sammanslagna listan, med "+ Ny kategori…" som öppnar ett litet inline-fält.
5. **Hantering**: liten sektion i Kalendrar-vyn för att döpa om/ta bort egna kategorier.
6. Uppdatera `suggestCategory`, kalendervyer och Andreas verktygsschema till att acceptera fria kategorivärden i stället för hårdkodad union.

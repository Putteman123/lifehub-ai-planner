# Färdigställ vyerna för care-4-you

Grunden finns redan: personal- och brukarlista, brukarkort med anhöriga och medicinlista, insatsmallar, schema, karta och rapporter. Det som saknas för att hela flödet ska gå att testa är detaljvyer, redigering och testdata.

## Det som byggs

1. **Personalkort (ny sida)**
   - Klicka på en anställd och se hela kortet: kontaktuppgifter, roll, anställningsform, arbetstider, anteckningar.
   - Redigera direkt på kortet, aktivera/avaktivera i stället för att bara ta bort.
   - Lista över den anställdes kommande besök.

2. **Brukarkortet blir komplett**
   - Knappen "Ändra uppgifter" så att namn, adress, telefon, personnummer, portkod, nyckelinfo och anteckningar kan uppdateras (i dag går brukare bara att lägga upp).
   - Anhöriga: redigera befintlig anhörig och kryssrutor för vad anhörig får se (samtycke per område).
   - Medicinlista: redigera en rad, och en enkel logg "Given" med tid och vem som delade ut.

3. **Insatsmallar**
   - Redigera en befintlig mall (i dag går den bara att skapa och ta bort).
   - Visa var mallen används och möjlighet att lägga mallen direkt på ett besök från brukarkortet.

4. **Testdata för care-4-you**
   - Tre anställda, tre brukare med adresser i samma område, anhöriga, ett par insatsmallar, mediciner och besök både igår och kommande vecka – så att schema, karta och rapporter visar riktigt innehåll direkt.

## Tekniska detaljer

- Nya serverfunktioner i `src/lib/care-admin.functions.ts`: `getStaffDetail`, `setStaffActive`, `updateClient` (utökar `saveClient` med id), `updateRelative`, `setRelativeConsent`, `updateMedication`, `logMedicationEvent`, `updateTemplate`, `attachTemplateToVisit`. Samtliga med `requireSupabaseAuth` och samma org_admin/superadmin-kontroll som befintliga handlers.
- Ny route `src/routes/_authenticated/v.f.$slug.personal.$memberId.tsx` med egen `head()`; länk från personallistan.
- `v.f.$slug.brukare.$clientId.tsx` utökas med redigeringsdialoger och medicinlogg; `v.f.$slug.insatser.tsx` med redigering.
- Migration: `care_medication_events` används för loggen (skapas om den saknas) och `care_relatives` får samtyckesfält (jsonb) – med GRANT, RLS och org-scopade policyer via `is_org_member` / `can_manage_org`.
- Testdata läggs in som INSERT i samma migration, kopplat till organisationen med slug `care-4-you`.
- Ingen påverkan på LifeHub-delen eller din privata data.

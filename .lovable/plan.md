# Verksamhetsadmin – första modulen för hemtjänst

Målet är rollen som sköter allt administrativt hos ett vårdföretag. Den här nivån byggs först, så att personal-, brukar- och anhörigvyerna sedan kan byggas nedåt i hierarkin.

## Egen adress per testföretag

Varje kund får ett kortnamn (t.ex. `solglantan`) som blir företagets egen ingång: `solglantan.mellberg.online`. Kortnamnet föreslås automatiskt från företagsnamnet när du lägger upp kunden och går att ändra.

- Appen känner igen kortnamnet i adressen och öppnar direkt rätt företags adminvy.
- Personer som inte tillhör företaget får ingen åtkomst, även om de kan adressen.
- Fungerar direkt i förhandsvisning via `/v/f/<kortnamn>`; för att de riktiga subdomänerna ska svara behöver en wildcard-post (`*.mellberg.online`) läggas till hos domänleverantören – jag skriver ut exakt vad som ska in när grunden är på plats.

## Adminens startvy

Startsidan är **Personal och brukare**: två listor sida vid sida med sökfält, antal och knappar för att lägga till. Överst en smal rad med företagets namn, kortnamn och dagens siffror.

## Delar som byggs nu

1. **Personal**
   - Lägga upp anställd (namn, e-post, telefon, roll, anställningsform).
   - Skicka inbjudan, se status (inbjuden / aktiv), aktivera och avaktivera.
   - Personalkort med kontaktuppgifter, arbetstider och anteckningar.

2. **Brukare och anhöriga**
   - Brukarregister: namn, personnummer, adress (med kartsökning), telefon, portkod, nyckelinfo, anteckningar.
   - Anhöriga kopplas per brukare med relation och kontaktuppgifter.
   - Samtycke styr vad anhörig får se – kryssrutor per område, precis som i behörighetsmatrisen.

3. **Schema och besök**
   - Veckovy per brukare och per anställd.
   - Lägga upp besök: tid, längd, brukare, ansvarig personal, typ av insats, återkommande mönster.
   - Varning när ett besök saknar personal eller krockar med ett annat.

4. **Uppgifter och medicin**
   - Insatsmallar (t.ex. dusch, städ, tillsyn) som kan kopplas till besök.
   - Checklista per besök.
   - Medicinlista per brukare med tid, dos och vem som får dela ut.

Allt begränsas av de moduler och behörigheter du redan sätter som superadmin – är en modul avstängd för kunden syns den inte.

## Din befintliga app

LifeHub och all din privata data lämnas orörd. Det här ligger kvar under vårddelen.

## Tekniska detaljer

- Ny kolumn `slug` på `organizations` (unik, lowercase) + hjälpfunktion för att generera den från namnet.
- Nya tabeller (alla med GRANT, RLS och org-scopade policyer via `is_org_member` / `can_manage_org`):
  `care_relatives`, `care_visits`, `care_visit_tasks`, `care_task_templates`, `care_medications`, `care_medication_events`.
  `care_clients` utökas med personnummer, portkod, nyckelinfo.
  `org_members` utökas med telefon, anställningsform, arbetstider.
- Nya serverfunktioner i `src/lib/care-admin.functions.ts` (`requireSupabaseAuth` + org_admin/superadmin-kontroll i varje handler): personal-CRUD, brukar-CRUD, anhörig + samtycke, besök-CRUD, uppgifter, medicin.
- Nya routes under `src/routes/_authenticated/v/f.$slug.*`: `index` (personal + brukare), `personal`, `brukare`, `brukare.$clientId`, `schema`, `insatser`. Layouten slår upp org via slug och avbryter om användaren inte är medlem.
- `src/server.ts` läser värdshuvudet: är det `<slug>.mellberg.online` görs en intern omskrivning till `/v/f/<slug>`, så både subdomän och sökväg fungerar.
- Behörighetsfiltrering återanvänder `visibleModules` och `org_permissions`.

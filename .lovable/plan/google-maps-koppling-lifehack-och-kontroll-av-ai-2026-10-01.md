# Google Maps-koppling "LifeHack" och kontroll av /ai

## 1. Google Maps-kopplingen
- Visa kopplingskortet för Google Maps i chatten. Där väljer du en befintlig koppling eller skapar en ny med namnet "LifeHack" (helst med "Använd egna inloggningsuppgifter" och din Maps-nyckel).
- När kopplingen är klar använder kartorna i appen den i första hand. Den nuvarande lösningen finns kvar som reserv.
- Kontrollera att kartan laddar i förhandsvisningen.

## 2. Kontroll av /ai och /github på mellberg.online
- Obs: borttagningen av vårddelen och de nya sidorna /ai och /github är inte publicerade än. På mellberg.online finns de därför inte förrän du publicerar.
- Kontrollera nu i förhandsvisningen:
  - Som superadmin (patrick@mellberg.online) laddar AI-förbrukning och GitHub med riktig data eller ett ärligt tomt läge.
  - En vanlig användare får "Åtkomst nekad" och ingen data hämtas.
- När du har publicerat öppnar jag mellberg.online/ai och /github och gör samma kontroll där.
- Jag publicerar inte själv.

## Tekniskt
- Koppla med connector_id google_maps. Webbläsarnyckeln hämtas via befintliga maps-key.functions.ts: först kopplingens nyckel, sedan nuvarande reserv.
- Kontroll med Playwright: en session för superadmin och en för ett konto som inte är ägare.

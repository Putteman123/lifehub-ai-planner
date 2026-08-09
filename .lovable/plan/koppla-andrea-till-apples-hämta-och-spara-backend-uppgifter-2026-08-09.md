# Koppla Andrea till Apples – hämta och spara backend-uppgifter

## Bakgrund

Project URL och API Key för Apples visas inte i Lovable Clouds UI. De ligger i projektets `.env`-konfiguration. Jag har läst konfigurationen från Apples-projektet och kan sätta in de två värdena åt dig.

## Plan

1. **Spara hemligheter i LifeHub**
   - Lägg till `APPLES_SUPABASE_URL` och `APPLES_SUPABASE_KEY` i Cloud → Secrets med värdena från Apples `.env`.
   - Använder den publicerbara (anon) nyckeln för läsåtkomst.

2. **Verifiera kopplingen**
   - Anropa ett testverktyg (t.ex. `apples_search_cases`) för att bekräfta att Andrea kan läsa ärenden från Apples.
   - Kontrollera att inga RLS-fel returneras.

3. **Hantera eventuell behörighet**
   - Om anon-nyckeln nekas av RLS i Apples, byter vi till service role-nyckel eller justerar läsbehörigheten i Apples.
   - Meddelar dig resultatet och vad vi eventuellt behöver ändra.

4. **Testa via Andrea**
   - Ställ frågor till Andrea om ärenden/klienter/deadlines i Apples för att bekräfta att allt fungerar i chatten.

## Tekniskt

- Värdena kommer från Apples `.env` (`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`).
- `apples.server.ts` skickar nyckeln korrekt oavsett om den är en opak `sb_publishable_…`-nyckel eller en JWT-nyckel.
- Inga värden visas i chatten; de sparas direkt som krypterade hemligheter.

# Aktivera Places API (New) och lås nyckeln till mellberg.online

Appen är redan förberedd: din egen nyckel används först, och om Google nekar den faller appen automatiskt tillbaka till Lovables karttjänst. Det som återstår kan bara göras i Google Cloud Console, eftersom det är ditt Google-konto som äger nyckeln.

## Vad du gör i Google Cloud Console

1. Gå till **API:er och tjänster → Bibliotek** och sök efter **Places API (New)** – klicka **Aktivera**.
   (Aktivera gärna samtidigt om de saknas: Maps JavaScript API, Geocoding API, Routes API, Street View Static API, Maps Static API.)
2. Gå till **API:er och tjänster → Autentiseringsuppgifter** och öppna din nyckel.
3. Under **API-begränsningar**: välj "Begränsa nyckel" och markera de API:er du aktiverat ovan.
4. Under **Webbplatsbegränsningar (HTTP-referrers)**, lägg till exakt dessa rader:
   - `https://mellberg.online/*`
   - `https://www.mellberg.online/*`
   - `https://*.lovable.app/*` (så förhandsgranskningen fortsätter fungera)
5. Spara. Ändringen gäller inom några minuter.

## Vad jag gör efteråt

1. **Verifierar platssökningen**: testar förslagsfunktionen (adressfältet i appen) och ser att Google svarar 200 i stället för 403 – både i förhandsgranskningen och med tanke på mellberg.online.
2. **Verifierar kartan**: kontrollerar att kartan laddas och att platser i närheten hämtas.
3. Om något fortfarande nekas läser jag av Googles felorsak och säger exakt vilken inställning som saknas.

## Tekniskt

- Ingen kod behöver ändras: `src/lib/google.server.ts` försöker din nyckel först och faller tillbaka till connector-gatewayen vid fel – så fort nyckeln tillåter Places API (New) används den direkt.
- Platssökning, platsdetaljer och närliggande platser går via servern (`places/v1/places:autocomplete`, `place details`, `searchNearby`), aldrig från webbläsaren, så inga nycklar exponeras.
- Ingen ändring i databasen eller i övriga delar av appen.

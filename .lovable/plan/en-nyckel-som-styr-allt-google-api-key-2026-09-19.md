# En nyckel som styr allt: GOOGLE_API_KEY

## Var du klistrar in nyckeln

Du klistrar **inte** in den i koden. Den ska ligga i Lovable under **Project Settings (kugghjulet) → Secrets → `GOOGLE_API_KEY`** — samma plats där du redan sparat den. Det är det enda stället nyckeln behöver finnas. Googles instruktion "key=API_KEY" beskriver hur nyckeln tekniskt skickas till Google; det sköter appen automatiskt.

Vill du byta ut värdet senare öppnar jag det säkra formuläret igen, eller så redigerar du hemligheten direkt i Project Settings.

## Vad planen gör i koden

Gör `GOOGLE_API_KEY` till den enda nyckel som allt Google-relaterat läser, i denna prioritetsordning överallt: `GOOGLE_API_KEY` → `GOOGLE_MAPS_OWN_KEY` (reserv) → Lovables delade nyckel (sista reserv).

1. **Kartor i webbläsaren** — `src/lib/maps-key.functions.ts` läser redan `GOOGLE_API_KEY`; verifiera att ordningen är rätt.
2. **Serveranrop** (platssök, geokodning, rutter) — `src/lib/google.server.ts` läser redan `GOOGLE_API_KEY`; verifiera.
3. **Firebase / Andrea-rösten** — `src/services/firebaseAI.ts` hämtar nyckeln via `ensureOwnMapsKey()`; ingen ändring behövs om ordningen i steg 1 är rätt.
4. **Andrea-chatten (backend)** — låt `src/lib/ai-complete.server.ts` och `/api/chat` även prova `GOOGLE_API_KEY` som Gemini-nyckel innan fallback till Lovable AI, så chatten kan köras på din nyckel.
5. **Kalender (Google Calendar)** — kalendern använder en egen koppling (OAuth/inloggning med Google-konto), inte API-nyckeln. Den påverkas inte; jag lägger en kort förklaring i appen så det är tydligt.

## Hos Google (kontroll i Google Cloud Console)

Samma nyckel måste tillåta: Maps JavaScript API, Places API (New), Geocoding API, Routes API, Street View Static, Maps Static **och** Firebase/Vertex AI (Generative Language). Domäner: `https://mellberg.online/*`, `https://www.mellberg.online/*`, `https://*.lovable.app/*`.

## Tekniskt

- Ändringar bara i: `src/lib/maps-key.functions.ts`, `src/lib/google.server.ts`, `src/lib/ai-complete.server.ts`, `src/routes/api/chat.ts` (prioritetsordning + ev. Gemini-fallback via `GOOGLE_API_KEY`).
- Ingen nyckel skrivs i koden; allt läses från hemligheter på servern respektive via serverfunktionen `getMapsBrowserKey` för webbläsaren.
- Verifiering: typecheck + build, sedan ett testanrop mot platssök och ett Andrea-anrop.

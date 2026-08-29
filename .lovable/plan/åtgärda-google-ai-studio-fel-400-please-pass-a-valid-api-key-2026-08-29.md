# Åtgärda "Google AI Studio-fel (400): Please pass a valid API key"

## Vad felet betyder

Google svarar `400 INVALID_ARGUMENT – Please pass a valid API key`. Det är inte ett fel i appens kod-logik: nyckeln som skickas med (`GEMINI_API_KEY`) accepteras inte av Google AI Studio. Den kan vara felinklistrad, återkallad, eller tillhöra ett projekt där Generative Language API inte är aktiverat.

Felet syns på Handla-sidan (och kan dyka upp på fler ställen) eftersom den delade AI-hjälpfunktionen som används av kvittoläsning, inköpsförslag, mejlskanning, dagskarta och Andreas snabbfil går direkt mot Google – utan reservväg. Andrea-chatten har redan en Lovable AI-reserv, men de här funktionerna har det inte.

## Åtgärder

1. **Ny giltig Gemini-nyckel**
   - Be om `GEMINI_API_KEY` på nytt via den säkra nyckelrutan och spara den.
   - Verifiera nyckeln med ett litet testanrop mot Google innan något annat, så vi vet att den fungerar.

2. **Reservväg för alla AI-funktioner utanför chatten**
   - Låt den delade textfunktionen falla tillbaka på Lovables AI när Google svarar med nyckel-/behörighetsfel (400/401/403) eller när nyckeln saknas.
   - Behåll samma svarsformat (inklusive JSON-scheman) så inköpsförslag, kvitton och mejlskanning fungerar oförändrat.

3. **Begripliga felmeddelanden**
   - Ersätt det råa Google-JSON-blocket i gränssnittet med ett kort svenskt meddelande, t.ex. "AI-nyckeln är ogiltig – Andrea använder reservtjänsten" eller "AI-tjänsten kunde inte nås just nu".

4. **Verifiering**
   - Testa "Förgyll med Andrea" på Handla, en kvittoinläsning och ett Andrea-meddelande.
   - Kontrollera bygg-, runtime- och konsolloggar efteråt.

## Klart när

- Handla-sidan visar inget rått Google-felmeddelande.
- AI-funktionerna svarar antingen via din Gemini-nyckel eller via reservtjänsten.
- Ett felaktigt nyckelläge ger ett tydligt svenskt meddelande i stället för en teknisk JSON-ruta.

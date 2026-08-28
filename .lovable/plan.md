# Få Andrea att svara igen

## Bekräftad orsak

Det senaste produktionsanropet till Andrea den 28 augusti kl. 19:07 UTC nådde `/api/chat`, men stoppades innan något modellanrop gjordes med felet:

`Invalid prompt: The messages do not match the ModelMessage[] schema.`

Det stämmer också med att inga AI Gateway-anrop registrerades under samma tidsfönster. Andreas lokalt sparade chatthistorik innehåller alltså minst ett äldre eller ofullständigt meddelande som den nuvarande AI-SDK-versionen inte kan konvertera.

## Åtgärder

1. **Reparera sparad historik automatiskt**
   - Validera historiken när Andrea öppnas.
   - Behåll giltiga användar- och assistentmeddelanden.
   - Ta bort ofullständiga fel-, verktygs- och fil-delar som inte längre följer aktuellt format.
   - Spara tillbaka den reparerade versionen så felet inte återkommer efter omladdning.

2. **Skydda serveranropet**
   - Normalisera inkommande UI-meddelanden före `convertToModelMessages`.
   - Om äldre historik fortfarande inte kan konverteras, gör ett enda säkert försök med den senaste giltiga användarfrågan i stället för att låta hela chatten krascha.
   - Returnera ett tydligt formatfel om även den senaste frågan är ogiltig; inga blinda AI-retries.

3. **Förbättra återställningen i panelen**
   - Låt ”Försök igen” skicka den reparerade senaste frågan.
   - Visa en specifik svensk text om historiken behövde återställas, i stället för det generiska AI-felet.
   - Behåll rensa-knappen som manuell sista utväg, men användaren ska normalt inte behöva rensa allt.

4. **Verifiera hela vägen**
   - Testa med en historik som innehåller gamla/tomma meddelandedelar.
   - Testa frågan ”När kan jag träna 90 min?” genom den autentiserade Andrea-vägen.
   - Bekräfta att Gemini verkligen anropas, att verktyget för ledig tid körs och att ett komplett svar visas.
   - Kontrollera produktions-/previewloggar och aktuell build efter ändringen.

## Tekniska detaljer

- Primärt berörs `src/components/andrea/Andrea.tsx` och `src/routes/api/chat.ts`.
- Befintlig Google AI Studio-, Lovable-reserv- och ElevenLabs-konfiguration lämnas oförändrad; felet ligger före modelltrafiken.
- Historikmigreringen ska vara bakåtkompatibel och aldrig skicka okända roller eller ogiltiga `parts` till modellen.

## Klart när

- Andrea svarar på den befintliga frågan utan att användaren först behöver rensa historiken.
- Giltig tidigare konversation finns kvar.
- Trasiga historikdelar kan inte längre blockera nya frågor.
- Ett verkligt Gemini-anrop och ett svar med kalenderdata är verifierade.
# Varför Andrea inte svarar – och vad jag gör åt det

## Vad jag hittade

Andreas kod är inte trasig. Alla hennes AI-anrop idag (16:28–16:29 UTC) stoppades av AI-tjänsten med koden 403 och orsaken `credit_hard_block_workspace` — arbetsytans AI-krediter är slut eller har nått en satt gräns. Det gäller både snabbfilen (`google/gemini-3.1-flash-lite`) och djupfilen (`openai/gpt-5.6-sol`). Senaste lyckade svaret var 27 aug 15:40 UTC.

Exempel: log_id `01a04934-a20a-7b3b-9148-3db2e9a1ff63`, 2026-08-28T16:29:41Z, http 403.

## Det du behöver göra

Fyll på AI-krediter för arbetsytan (eller höj den administrativa kreditgränsen om en sådan är satt). Direkt efter det fungerar Andrea igen utan några kodändringar.

## Det jag gör i appen

1. **Tydligt felmeddelande i stället för "Något gick fel."**
   - `/api/chat` skickar vidare statuskoden och ett läsbart skäl när AI-tjänsten nekar.
   - Andrea-panelen visar då t.ex. "AI-krediterna är slut – fyll på så svarar jag igen." vid 403/402, "För många frågor just nu, vänta en stund." vid 429, och "Ingen kontakt med AI-tjänsten." vid nätverksfel.
   - Ingen automatisk omförsök vid 402/403 (det ger bara samma fel); en "Försök igen"-knapp på raden.

2. **Samma sak för rösten.**
   - `/api/tts` skiljer på "ElevenLabs svarade inte" och "krediter slut" så hon faller tillbaka tyst i stället för att verka trasig.

## Tekniskt

- `src/routes/api/chat.ts`: fånga fel från `streamText` och returnera status + kort svensk text; skicka igenom gatewayens status i stället för en generisk 500.
- `src/components/andrea/Andrea.tsx`: `onError` mappar status/meddelande till de texter som listas ovan och renderar en retry-knapp.
- `src/routes/api/tts.ts`: logga och skilja på ElevenLabs-fel och gateway-403 innan fallback.

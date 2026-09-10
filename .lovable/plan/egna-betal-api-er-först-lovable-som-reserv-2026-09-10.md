# Egna betal-API:er först – Lovable som reserv

Andrea ska använda dina egna betalda konton (Perplexity, Gemini, ChatGPT) i första hand. Om något av dem inte svarar eller tar slut går appen automatiskt vidare till Lovable som reserv, så Andrea aldrig blir tyst.

## Så här gör vi

1. **Byt Perplexity-konto** – jag öppnar en kopplingsruta där du väljer samma Perplexity-konto som du använder i Apples.
2. **Koppla ChatGPT** – du klistrar in din OpenAI-nyckel i ett säkert fält i chatten (hämtas på platform.openai.com under API keys). Jag kopplar aldrig in den i vanlig text.
3. **Prioritetskedja för Andreas svar:** ChatGPT först, sedan Gemini, sist Lovable. Misslyckas ett steg provas nästa automatiskt – du märker inget avbrott.
4. **Webbsökning:** fortsätter gå via Perplexity (din nyckel), precis som i Apples.
5. **Bilder och kvitton:** Gemini först, Lovable som reserv.
6. **Test:** jag kör en provfråga till Andrea och en provsökning, och visar att svaren kommer från rätt tjänst.

## Om något strular

- Är en nyckel fel eller ett saldo slut hoppar Andrea själv vidare till reserven, och appen visar en vänlig text istället för ett tekniskt fel.
- Inget av dina sparade data ändras – det handlar bara om vilken tjänst som svarar.

## Tekniskt (för den nyfikne)

- Ny nyckel `OPENAI_API_KEY` sparas krypterat och läses bara på serversidan.
- `completeText` i `src/lib/ai-complete.server.ts` byggs om till en kedja: OpenAI → Gemini → Lovable, med samma svenska felmeddelanden som idag.
- `websearch.server.ts` fortsätter mot Perplexity med din nyckel; kontobytet sker via kopplingsrutan.

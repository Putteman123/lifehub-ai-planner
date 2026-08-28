# Andrea med betald Gemini API som förstahandsval

## Mål
Andrea ska i första hand använda din betalda Google AI Studio API, oberoende av Lovables AI-krediter. ElevenLabs fortsätter användas separat för röst.

## Genomförande
1. Lägg in din Google AI Studio API-nyckel som en krypterad serverhemlighet; den exponeras aldrig i webbläsaren eller källkoden.
2. Bygg en serveradapter för Googles direkta, strömmande Gemini API med stöd för Andreas konversationer, bifogade filer och verktygsanrop.
3. Sätt `gemini-3.6-flash` som primär modell eftersom Googles aktuella dokumentation anger den som den senaste stabila Gemini-modellen. Samla modellvalet på ett ställe så nästa stabila toppmodell enkelt kan aktiveras utan att ändra resten av appen.
4. Låt både Andreas snabbfil och djupfil använda den betalda Gemini-anslutningen först. Behåll Lovable AI Gateway endast som reserv vid tillfälliga Google-fel, inte vid konfigurations-, behörighets- eller betalningsfel.
5. Uppdatera Andreas statuskort så det tydligt visar tre separata tjänster: Google AI Studio (primär text-AI), Lovable AI (reserv) och ElevenLabs (röst), med modell och senaste status.
6. Testa ett verkligt textanrop, ett verktygsanrop och ett strömmande chatsvar genom samma väg som appen använder.

## Tekniska detaljer
- Använd Googles officiella Gemini REST/API-kontrakt från servern och läs nyckeln inne i request-handlern.
- Ingen artificiell timeout. Endast begränsad backoff för 429/5xx; övriga fel visas direkt.
- Reservvägen får inte dölja fel som kräver åtgärd i Google AI Studio, exempelvis ogiltig nyckel eller slut på Google-kvot.
- Befintlig autentisering och Andreas verktygsbehörigheter bevaras.

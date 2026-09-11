# Dela appen med Google AI

En ny funktion där LifeHub automatiskt skickar en beskrivning av hela appen (struktur och viktig kod) till Google AI (Gemini) och visar svaret direkt i appen. Bra för att få analys, förbättringsförslag eller felsökningshjälp om själva bygget.

## Så fungerar det för dig

1. Ny sektion "Dela med Google AI" under Mer/Inställningar.
2. Du väljer vad Google AI ska titta på: hela appen, bara ekonomidelen, bara platser, eller egen fråga.
3. Du trycker på "Skicka till Google AI" – appen paketerar och skickar automatiskt.
4. Svaret visas i appen, med möjlighet att spara det som anteckning.
5. Du ser alltid en förhandsvisning av vad som skickas innan du trycker, och inga lösenord, nycklar eller kassaskåpsdata följer med.

## Vad som skickas

- Filträd över projektet
- Innehållet i de viktigaste kodfilerna (avkortat vid storleksgräns)
- Kort beskrivning av appens funktioner
- Aldrig: hemligheter, .env, kassaskåp, personliga data ur databasen

## Teknisk lösning

- Nytt build-steg genererar en kodögonblicksbild (`src/generated/app-snapshot.json`): filträd + innehåll för utvalda mappar (`src/lib`, `src/routes`, `src/components`), med filter mot `.env`, nycklar och genererade filer, samt teckenbudget per fil och totalt.
- Ny serverfunktion `src/lib/share-code.functions.ts` (`shareWithGoogleAI`) som bygger prompten och anropar Google AI via befintlig `google-ai.server.ts`-fetch. Vid kvotfel (429) faller den tillbaka till Lovable-modellen precis som `ai-complete.server.ts` gör idag.
- Långa svar streamas inte i första versionen; anropet körs med rimlig modell för lång kontext (Gemini Flash) och svaret returneras som text.
- Ny komponent `src/components/ShareCodeCard.tsx` med val av fokus, egen fråga, förhandsvisning av vad som skickas, skicka-knapp och svarsvy.
- Ingen ändring i befintlig data, ekonomilogik, platser eller Andrea.

## Öppna frågor som inte blockerar

Om snapshotten blir för stor för en förfrågan delas den upp i två anrop (struktur först, sedan detaljer) och svaren slås ihop.

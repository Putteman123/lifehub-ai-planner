# Flytta vårddelen (Alfa 1.0) till ett eget projekt

## Så här går flytten till

Remix kopierar hela projektet — det finns ingen funktion som kopierar bara en del. Därför remixar vi allt och rensar sedan bort LifeHub-delen i kopian, så att bara vårdsystemet (Alfa 1.0) finns kvar. Din nuvarande app och all data rörs inte.

### Steg 1 – du gör (tar en minut)
1. Högerklicka på projektet i sidlistan (eller projektnamnet uppe till vänster → Inställningar → "Remix this project").
2. Döp kopian till t.ex. **Alfa 1.0 – Hemtjänst**.
3. Öppna det nya projektet och skriv till mig där: "Rensa bort LifeHub".

### Steg 2 – jag gör i det nya projektet
- Tar bort allt som hör till din privata LifeHub: dashboard, kalender, barn, jurist, inköpslista, ekonomi, kvitton, IPTV, kassaskåp, resor, Gmail-skanning m.m.
- Behåller det som vårddelen bygger på: inloggning + PIN, Andrea-chatt, hela vårdsystemet under `/v/...` (kunder, verksamheter, personal, brukare, schema, karta, insatser, medicin, handla, ekonomi, rapporter, samtal), demoläget `/demo/alfa-demo` och rollväxlaren.
- Gör vårdens översikt till startsida — appen öppnar direkt i vårdläge.
- Kör om databasmigrationerna i det nya projektets backend (kundregister, behörigheter, besök, mediciner, chatt, inköp, ekonomi, pushtokens) och lägger in Alfa Demo-företaget igen.
- Namnger appen Alfa 1.0 och verifierar att allt bygger och fungerar.

### Steg 3 – du gör efteråt (jag guidar)
- Lägg in nycklarna på nytt i det nya projektet: `GOOGLE_API_KEY` (kartor, Firebase, Andrea), samt vid behov `OPENAI_API_KEY` / `GOOGLE_CALENDAR_API_KEY`. Hemligheter följer inte med en remix.
- Subdomäner (`care-4-you.mellberg.online`, `alfa-demo...`): koden följer med, men DNS/publicering pekar idag på detta projekt. Välj: flytta domänen till nya projektet, eller kör på nya projektets egen adress (`*.lovable.app`) tills vidare.

## Vad som INTE flyttas automatiskt
- Databasens innehåll (riktiga kunder/brukare) — nytt projekt får ny tom backend + Alfa Demo-datat. Demo-datat räcker för demonstrationer; skarp data läggs in via kundregistret.
- Hemligheter/nycklar (steg 3).
- Publicerad domän — måste kopplas om om du vill ha mellberg.online-adresserna där.

## Tekniska detaljer
- Rensning: rutter utanför `v.*`/`demo`/`auth`/`invite` tas bort, nav-tema och `APP_NAME` sätts till Alfa 1.0, startsidan `/` omdirigerar till vårdens vy, serverns subdomän-rewrite behålls.
- Migrationer körs i samma ordning (kundregister → behörigheter → besök/medicin → chatt → inköp/ekonomi → pushtokens → alfa-demo-data).
- Verifiering: `bunx tsgo --noEmit` grönt, build OK, samt genomgång av demo i alla fyra roller.

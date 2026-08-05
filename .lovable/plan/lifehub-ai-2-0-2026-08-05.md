# LifeHub AI 2.0

En samlad uppgradering: nytt utseende, färgstarkare ikoner, lägesanimationer, Andrea på Perplexity + Gemini med Lovable AI som skyddsnät, och en full genomgång av navigation och buggar.

## 1. Nytt utseende

- Typsnitt: Space Grotesk för rubriker, DM Sans för brödtext (laddas via `<link>` i rotlayouten, sätts som `--font-display` / `--font-sans`).
- Färgpalett "Nordisk indigo": ljus bas (#F7F8FC), indigo som primärfärg (#4F46E5), bärnsten (#F59E0B) och grön (#10B981) som accenter. Allt som oklch-tokens i `src/styles.css`, både ljust och mörkt läge.
- Kategorifärgerna (Jobb, Ledig, Jurist, Barn, Privat, Viktigt) justeras så de harmoniserar med den nya paletten men behåller sin betydelse.
- Kort, knappar och paneler får mjukare skuggor och lite mer luft.

## 2. Färglagda, tydligare ikoner

- Varje del av appen får en egen ikonfärg (t.ex. Kalender indigo, Handla grön, Jurist bärnsten, Barn gul, Kassaskåp röd).
- Flytande menyn visar färgad ikon i en tonad bricka; aktivt läge fylls helt.
- Samma färgspråk återanvänds i kortrubriker och listor så ikonen alltid betyder samma sak.

## 3. Animationer per läge

- Sidbyten får en mjuk fade + lyft när man byter vy.
- Menyn: aktiv ikon glider med en markör mellan lägena.
- Lägesspecifika detaljer: butiksläget i Handla pulserar när en vara bockas av, Andrea får en lugn andningsanimation när hon lyssnar/talar, kassaskåpet behåller sin öppningsanimation men synkas mot nya färger.
- Allt respekterar "reducerad rörelse" i systeminställningarna.

## 4. Andrea med Perplexity + Gemini + Lovable AI

- Perplexity kopplas som connector (säker inloggning i chatten) och används för frågor som kräver färsk webbinfo, med källhänvisningar i svaret.
- Gemini: du kopplar ditt eget Google-konto/nyckel; Gemini används som snabb modell för sammanfattningar och analyser.
- Fallback-kedja: om Perplexity eller Gemini fallerar (nyckel saknas, kvot slut, fel) går anropet automatiskt vidare till Lovable AI så Andrea alltid svarar. Vilken källa som användes visas diskret i svaret.
- Andreas verktyg (kalender, resor, inköp, todo) fungerar likadant oavsett modell.

## 5. Komplett kontroll och buggfix

- Går igenom alla vyer: Översikt, Kalender, Att göra, Handla, Barn, Jurist, Platser, Kassaskåp, Kalendrar, Lås/Face ID.
- Kontrollerar att varje länk och knapp leder rätt, att alla datakopplingar laddar och sparar, och att behörigheterna i databasen är på plats.
- Testar flöden i webbläsaren (inklusive iPhone-bredd) och rättar fel som dyker upp: layout som spiller över, tomma tillstånd, felhantering vid nätverksfel.
- Säkerhetsgenomgång av databasens regler.

## 6. Version 2.0

- Versionsnummer 2.0 sätts i appen och visas diskret i Kalendrar/inställningar.

## Teknisk sammanfattning

- `src/styles.css`: nya oklch-tokens, typsnittsvariabler, kategorifärger; fontlänkar i `src/routes/__root.tsx`.
- Ny `src/lib/nav-theme.ts` med ikon- och färgkarta som `FloatingNav` och sidhuvuden delar.
- Animationer via Tailwind-utilities och `@utility`-regler i styles.css, plus `prefers-reduced-motion`-variant.
- AI-routing samlas i en ny serverhjälpare (t.ex. `src/lib/ai-router.server.ts`) som Andrea/agenten kallar: Perplexity via connector-gateway, Gemini via egen nyckel, Lovable AI (`openai/gpt-5.6-sol`) som fallback.
- Perplexity kopplas med connector-verktyget; Gemini-nyckeln begärs via säker secret-ruta när planen godkänts.
- QA görs med Playwright mot körande app plus typkontroll och databaslinter.

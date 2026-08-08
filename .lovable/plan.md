# Platser med AI-dagskarta, en friare Andrea och IPTV-skapande

## 1. Platser: AI som kartlägger din dag

Idag registreras råa positioner och besök var för sig. Nu byggs ett steg emellan som tolkar dygnet:

- **Dagsanalys.** En knapp "Analysera dagen" (och automatisk körning för gårdagen) går igenom positionshistoriken och delar upp den i stopp och förflyttningar: när du kom, när du åkte, vilken väg, hur långt och med vilket färdsätt.
- **Korta besök missas inte.** Stopp ner till några minuter fångas upp (t.ex. hämtning vid skolan, tanka, snabbt ärende) i stället för att svälja dem i en lång resa.
- **AI sätter namn och syfte.** Okända stopp får förslag på plats och aktivitet utifrån dina sparade platser, tidigare besök, kalendern och närliggande adress – t.ex. "Skolan – hämtning" eller "Ica Maxi – handling".
- **Sammanhängande dagsberättelse.** Överst på Platser visas dagen som en tidslinje: hem → resa 14 min bil → skolan 6 min → Ica 22 min → hem, med totalt antal km och tid.
- **Du bestämmer.** Varje AI-förslag visas som förslag med "Godkänn" / "Ändra" / "Ignorera", och du kan slå ihop, dela eller döpa om direkt i listan. Inget skrivs över utan att du sagt ja.

## 2. Andrea: personligare och med fulla rättigheter

**Personlighet.** Andrea får ett varmare, mer personligt tilltal: hon minns hur dagen sett ut, kommenterar mönster ("du har tre kvällspass i rad – vill du att jag flyttar juristärendet?"), växlar ton efter tid på dygnet och håller sig kort men mänsklig. Ny "Om dig"-profil (tilltal, hur rak hon får vara, vad hon ska bry sig extra om) som du kan ändra i appen.

**Full åtkomst.** Hon får verktyg för att läsa **och** rätta all data i appen: kalender och kategorier, barn, juristärenden, Att göra, påminnelser, platser, besök och resor, inköpslista och skafferi, IPTV-användare samt hela ekonomidelen (konton, inbetalningar, fasta utgifter, utgifter). Alltså inte bara skapa – även rätta felaktiga poster och ta bort dubbletter, med kort bekräftelse på vad hon ändrat.

**Kassaskåpet.** Enligt ditt val får hon läsa och skriva allt: söka fram, läsa upp och spara lösenord, pinkoder och koder. Två skydd behålls: kassaskåpet måste vara upplåst i sessionen (Face ID eller pinkod), och hemligheter loggas aldrig till någon extern tjänst utöver det svar hon ger dig.

**Koppling till Apples (PM Juridik).** Andrea får läsrättigheter mot Apples-projektets databas via en nyckel du lägger in som hemlighet här. Hon kan då söka ärenden, klienter, dokument och deadlines där och väva ihop dem med LifeHubs kalender och Att göra – t.ex. "du har huvudförhandling i Nilsson-ärendet på torsdag, och kalendern krockar". Endast läsning; inget skrivs i Apples. Hon får också PM Juridiks arbetssätt i sin systemprompt så hon blir en bättre juridisk kompanjon.

Jag behöver två saker från dig efter godkännande (jag ber om dem i en säker ruta): Apples backend-URL och en nyckel med läsrättighet.

## 3. IPTV: skapa användare direkt i appen

- Knappen "Ny M3U-användare" öppnar ett formulär: paket, antal anslutningar, längd (1/3/6/12 månader), eget användarnamn/lösenord eller automatiskt genererat, samt anteckning.
- Kontot skapas mot panelens API, och direkt efteråt visas en ruta med **användarnamn, lösenord, M3U-länk och utgångsdatum** med kopieringsknappar. Uppgifterna sparas på raden i listan.
- **Skicka som mejl:** knapp som öppnar ett färdigt mejl (mottagare, ämne, uppgifter och länk) och skickar via Gmail-kopplingen.
- Utgångsdatumet läggs som vanligt in i kalendern med kategorin IPTV.

## Tekniska detaljer

- **Dagsanalys:** ny `src/lib/day-mapping.server.ts` som segmenterar `positions` (stopp = låg förflyttning inom radie under ≥3 min, annars färd) och anropar Lovable AI (`openai/gpt-5.6-sol`) med kandidatstopp + sparade platser + dagens kalender för namn/aktivitet. Resultat sparas som förslag i ny tabell `day_segments` (status `pending`/`accepted`) och skrivs till `visits` först vid godkännande. Server function i `src/lib/day-mapping.functions.ts`; UI-kort `src/components/platser/DayMap.tsx` ovanför `VisitLogList`. Återanvänder `travel-classify.server.ts` för färdsätt.
- **Andrea:** `agent.server.ts` utökas med verktyg för `events`, `event_categories`, `children`, `legal_cases`, `case_tasks`, `todos`, `reminders`, `places`, `visits`, `shopping_items`, `pantry_items`, `iptv_lines`, `finance_*` samt `vault_items` (kräver upplåst kassaskåp – flagga skickas från klienten och verifieras serverside). `ANDREA_SYSTEM` i `andrea.server.ts` skrivs om för personlighet + ny tabell `andrea_profile`.
- **Apples-koppling:** hemligheter `APPLES_SUPABASE_URL` och `APPLES_SUPABASE_KEY`; ny `src/lib/apples.server.ts` med read-only-klient och verktygen `apples_search_cases`, `apples_get_case`, `apples_search_documents`, `apples_deadlines`. Endast SELECT.
- **IPTV:** `iptv.server.ts` får `createLine`/`getLine` mot `activationpanel.net/api/api.php`; server functions i `iptv.functions.ts`; ny `NewLineDialog.tsx` + `CredentialsCard` i `IptvUserList.tsx`. Mejl via befintlig `send_mail`-funktion i `google.server.ts`.
- Migration: `day_segments`, `andrea_profile`, samt `iptv_lines`-kolumner för lösenord/M3U-URL – med GRANT och RLS per användare.

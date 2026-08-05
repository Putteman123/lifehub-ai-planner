# Förenkla LifeHub: fokus på AI, kalender och vardag

Apple Hälsa / Health Auto Export / Sleep Cycle läggs på is. Istället förenklar vi gränssnittet och låter Andrea bli mer proaktiv.

## Mål

- Ett renare, enklare gränssnitt som känns mer "Apple/Linear".
- Andrea ska agera mer som en riktig assistent: varna, föreslå och förbereda.
- Smartare kalender utan nya externa integrationer.

## Vad som byggs

### 1. Förenkla dashboard

- Ett enda sammanhållet flöde istället för många små kort.
- Överst: dagens agenda med klickbara tider → öppnar dagvyn.
- Därefter: Andrea-sammanfattning av dagen (proaktiv text, inte bara lista).
- Veckokortet blir en horisontell tidslinje istället för 7 separata rutor.
- Månadsminiatyren blir större och klickbar.
- Dölj eller flytta mindre viktiga widgets (deadlines/påminnelser) till sidopanel.

### 2. Gör Andrea proaktiv

- Andrea skickar varje morgon en kort sammanfattning:
  - "Du har 4 möten idag, en krock mellan lunch och juristmötet, och du har barnen 15–18."
  - Förslag: "Vill du att jag föreslår en ny tid för juristmötet?"
- Andrea varnar när något ser konstigt ut:
  - två aktiviteter krockar,
  - för lite sömn (om användaren fyller i det manuellt senare),
  - hög arbetsbelastning flera dagar i rad.
- Snabbval under Andrea-bubblan:
  - "Visa min lediga tid"
  - "Planera om dagen"
  - "Vad har barnen denna vecka?"
  - "Sammanfatta veckan"

### 3. Smartare kalender

- Markera krockar visuellt (röd varningsikon).
- "Ledig tid"-sökare: användaren skriver "när kan jag träna 90 min?" och Andrea svarar med förslag.
- Auto-taggning: nya händelser föreslås kategori baserat på titel (AI i bakgrunden).

### 4. Juristvyn

- Tydligare översikt: aktiva ärenden, kommande tidsfrister, nästa möte.
- Knapp för att snabbt skapa ärende + första uppgift i ett steg.

### 5. Barnvyn

- Kommande 14 dagarna: vem har barnen, träningar, läkarbesök, lov.
- Möjlighet att lägga till aktivitet direkt från barnvyn.

## Tekniska detaljer

- Inga nya externa API:er eller betalappar.
- Använder befintliga tabeller: events, children, legal_cases, case_tasks, reminders.
- Andrea bygger på befintlig `andrea.server.ts` och `/api/chat.ts`.
- UI använder samma Tailwind-tokens; inga nya färger.

## Uteslutet

- Apple Health, Health Auto Export, Sleep Cycle, manuell hälsoruta.
- Nya betalintegrationer eller externa kalenderkällor.

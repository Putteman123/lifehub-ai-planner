# Omtag av Pengar: inkomster, månadsbild och tydligare gränssnitt

## Vad som förändras

### 1. Inkomster registreras som utgifter
Idag är en inkomst bara en förväntad post ("nästa lön") utan koppling till konto eller saldo. Den blir en riktig transaktion:

- Varje inkomst får konto, faktiskt mottaget datum och möjlighet att justera beloppet vid mottagning.
- När du markerar en inkomst som inkommen läggs beloppet automatiskt till på valt konto — spegelbild av hur ett köp dras av. Ångrar du markeringen dras det av igen.
- Snabbknapp "Extra inkomst" för engångsinkomster (sålt något, swish, återbetalning, bonus) som registreras direkt som mottagen med dagens datum, belopp, konto och kategori.
- Ny typ "Extra" i listan över inkomsttyper, vid sidan av Lön, Ersättning, Bidrag, Lån.

### 2. Månadsvy
Nytt månadskort högst upp med månadsväljare (bläddra bakåt/framåt):

- Tre nyckeltal: In, Ut, Netto (grönt/rött).
- Stapeldiagram över månadens dagar samt en delad stapel in vs ut, plus kategorifördelning för utgifter.
- Ut = registrerade köp + fasta utgifter som betalats den månaden, så siffran motsvarar verkligheten.
- Lista med månadens inkomster och de största utgifterna, klickbara för detaljer.

### 3. Grafiskt omtag med flikar
Pengar-sidan delas i fem flikar istället för ett långt kortflöde:

- **Översikt** – dagsbudget, saldon per konto, månadskortet, varningar och AI-insikt.
- **Inkomster** – kommande och mottagna inbetalningar, extra inkomster, lönespecar.
- **Utgifter** – snabbregistrering, kvittoskanner, kategoridiagram, utgiftslista.
- **Fasta** – fasta utgifter, prenumerationer, lån, betalningsstatus per månad.
- **Mer** – överföringar, spel, mailfynd, filer.

Toppen får en sammanfattningsrad (saldo, att spendera idag, netto denna månad) som alltid syns, med tydligare typografi, färgkodning (grönt in / rött ut) och luftigare kort i appens Aurora Glass-stil.

## Tekniskt

- Migration på `finance_incomes`: nya kolumner `account_id` (referens till `finance_accounts`), `received_on date`, `note text`, `category text`. `INCOME_KINDS` utökas med `extra`.
- `src/lib/finance.ts`: nya hooks `useSaveIncome` / `useDeleteIncome` / `useSetIncomeReceived` som justerar kontosaldo på samma sätt som `useSaveSpend` (återför gammalt belopp vid ändring, drar av vid ångrad mottagning).
- `buildBudget` utökas med `incomeThisMonth` och `netThisMonth`; befintliga fält lämnas orörda så MoneyWidget och dashboard fortsätter fungera.
- Ny `src/lib/month-summary.ts` med `monthWindow(date)`, `monthSummary(spends, incomes, fixed, payments, month)` → { income, spent, net, byCategory, byDay } plus enhetstester i `src/lib/month-summary.test.ts`.
- Nya komponenter: `src/components/pengar/MonthOverviewCard.tsx` (recharts, samma bibliotek som SpendPieCard), `src/components/pengar/IncomesCard.tsx` (utbruten och utökad från pengar.tsx), `src/components/pengar/QuickIncomeButton.tsx`, `src/components/pengar/MoneyHeader.tsx`.
- `src/routes/_authenticated/pengar.tsx` skrivs om till en flikstruktur med shadcn `Tabs`; befintliga kort flyttas in i respektive flik utan ändrad affärslogik.

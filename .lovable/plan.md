# Prenumerationer, återkommande betalningar och klickbara kategorier

## Vad du får

1. **Prenumerationsflagga när du registrerar ett köp**
   I utgiftsrutan (och i kvittoskannern) läggs två kryssrutor till: "Prenumeration" och "Lägg till som fast utgift". Kryssar du i något av dem skapas automatiskt en post under Fasta utgifter med namn, belopp, kategori och förfallodag hämtade från köpet.

2. **Återkommande intervall**
   En fast utgift kan vara månadsvis, kvartalsvis, halvårsvis eller årsvis. Statusen "betald / kommande / förfallen" och restskulder räknas bara på de månader posten faktiskt förfaller, så en årsprenumeration ligger inte och skriker varje månad.

3. **Automatiskt i kalendern**
   Varje aktiv fast utgift/prenumeration lägger heldagshändelser i kalendern 12 månader framåt: "Hyra 9 000 kr" på förfallodagen, med egen kategori **Ekonomi** och egen färg. Händelserna uppdateras när du ändrar belopp, dag eller intervall, och tas bort om du avaktiverar eller raderar posten. Markerar du månaden som betald får händelsen en bock i titeln.

4. **Klickbara kategorier**
   I "Vad pengarna går till" blir varje tårtbit och varje rad i teckenförklaringen klickbar. Du får upp en detaljvy för kategorin med:
   - total summa och andel av perioden, samt snitt per månad
   - lista över alla köp i kategorin (datum, butik/notering, konto, belopp)
   - de fasta utgifter/prenumerationer som ingår i kategorin
   - en enkel månadsstapel så du ser om kategorin ökar eller minskar
   Samma detaljvy nås även genom att klicka på en kategori i utgiftslistan.

## Teknisk plan

**Databas (migration)**
- `fixed_expenses`: nya kolumner `is_subscription boolean not null default false`, `interval_months integer not null default 1`, `anchor_month smallint` (vilken månad ett års-/kvartalsabonnemang startar), `sync_calendar boolean not null default true`.
- Inga nya tabeller; befintliga RLS-policys och grants gäller.
- Ny kategori "Ekonomi" i `event_categories`-defaults + färgtoken `--cat-ekonomi` i `src/styles.css`.

**Logik**
- `src/lib/fixed-expenses.ts`: `isDueInPeriod(row, period)` utifrån `interval_months`/`anchor_month`; `fixedViews`, `unpaidFixedTotal` och carry-over filtrerar på den.
- `src/lib/fixed-calendar.server.ts`: `syncFixedEvents(supabase, userId, expense)` som skapar/uppdaterar/raderar `events` med `external_id = fixed:<expenseId>:<YYYY-MM>` 12 månader framåt (idempotent, samma mönster som `iptv-calendar.server.ts`).
- `src/lib/finance.functions.ts`: serverfunktion `saveFixedExpense` som sparar raden och kör kalendersynken; `setFixedPaid` uppdaterar händelsens titel; radering rensar händelser.
- `src/lib/finance.ts`: `buildBudget` räknar fasta utgifter per period med det nya intervallstödet.

**UI**
- `pengar.tsx` → `FixedCard`-dialogen: kategori-väljare, växel "Prenumeration", intervall-väljare, växel "Visa i kalendern"; prenumerationer får en egen märkning i listan.
- `SpendCard` och `ReceiptScanner`: kryssrutorna som skapar fast utgift/prenumeration av köpet.
- Ny `src/components/pengar/CategoryDetailDialog.tsx` som `SpendPieCard` och utgiftslistan öppnar vid klick på kategori.

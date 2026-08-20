# Lån i Pengar

Lägg till lån du har tagit: pengarna syns som en inbetalning när de kommer in, och varje månad skapas en amorteringspost och en separat ränterad bland de fasta utgifterna.

## Så fungerar det

**Nytt kort "Lån" under Pengar**
- Knapp "Nytt lån" med: namn (t.ex. "Billån SEB"), lånebelopp, utbetalningsdatum, konto pengarna kom in på, månadsbetalning (amortering), räntebelopp per månad, förfallodag i månaden.
- Listan visar varje lån med månadsbelopp, ränta per månad och totalt betalt hittills.
- Redigera och ta bort som övriga poster.

**Inbetalning**
- När ett lån skapas läggs lånebeloppet automatiskt in som en inbetalning med typen "Lån" på utbetalningsdatumet, så saldot/budgeten stämmer.

**Utbetalning + ränta**
- Två återkommande fasta utgifter skapas per lån:
  - "<Lånets namn> – amortering"
  - "<Lånets namn> – ränta"
- De hamnar i befintliga Fasta utgifter och följer samma flöde som resten: kan bockas som betalda per månad, matchas mot uppladdade fakturor, och följer med som röd uppgift i Att göra om de inte betalas i tid.
- Ändrar du månadsbelopp eller ränta på lånet uppdateras de två raderna.

**Statistik**
- Ny utgiftskategori "Lån" (amortering) och "Ränta" så de syns separat i tårtdiagrammet och kategorisummorna.

## Tekniskt

- Ny tabell `public.loans` (user_id, name, principal, disbursed_on, account_id, monthly_payment, monthly_interest, due_day, is_active, timestamps) med GRANT till authenticated/service_role, RLS `auth.uid() = user_id`, och updated_at-trigger.
- Länkkolumner: `finance_incomes.loan_id`, `fixed_expenses.loan_id` + `fixed_expenses.part` ('amortering' | 'ranta'), nullable, så befintliga poster är opåverkade.
- Ny `src/lib/loans.ts` med hook för hämtning samt logik som synkar lånet till en inbetalningsrad och två fasta utgifter (skapa/uppdatera/ta bort).
- Nytt `src/components/pengar/LoansCard.tsx`, monteras i `src/routes/_authenticated/pengar.tsx` intill Inbetalningar/Fasta utgifter.
- Kategorierna "lan" och "ranta" läggs till i utgiftskategorierna som används av `SpendPieCard` och kategorisummorna.
- Ingen ränteberäkning i procent — du anger kronbeloppet per månad, enligt ditt val.

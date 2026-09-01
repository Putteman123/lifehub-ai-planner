# Fasta utgifter drar från saldot när de bockas av

## Så fungerar det idag

När du bockar av en fast utgift som betald sparas bara en betalningsrad för månaden. Kontosaldot rörs inte, samtidigt som utgiften slutar räknas som "fasta kvar". Resultatet blir att "att spendera" hoppar upp fast pengarna fortfarande ligger kvar på kontot.

## Vad som ändras

- När du markerar en fast utgift som betald dras beloppet direkt från huvudkontot (det översta kontot i listan).
- Tar du bort bocken läggs beloppet automatiskt tillbaka på samma konto.
- Betalningen bokförs inte som ett vanligt köp, så den dyker inte upp i utgiftslistan, tårtdiagrammet eller "spenderat i mån." – ingen dubbelräkning.
- Månadsöversikten fortsätter visa fasta betalningar i sin egen rad precis som nu.
- Bockar du av flera gånger eller ångrar upprepat justeras saldot bara en gång per månad och post.

Det gäller överallt där en fast utgift kan bockas av: Pengar-sidan, Att göra-listan och när ett kvitto/faktura matchas mot en fast utgift.

## Tekniskt

- Migration: lägg till `account_id` (referens till `finance_accounts`) på `fixed_expense_payments`, så vi vet vilket konto som ska återföras vid ångra.
- `setFixedPaid` i `src/lib/finance.functions.ts`:
  - Vid `paid: true` – hoppa över om raden redan finns (idempotent), annars välj konto (medskickat `accountId`, annars kontot med lägst `sort_order`), spara raden med `account_id` och minska kontots saldo med beloppet.
  - Vid `paid: false` – läs den befintliga raden, öka saldot med dess `amount` på dess `account_id`, radera sedan raden.
  - Returnera vilket konto och belopp som justerades så UI kan visa "−1 250 kr från Lönekontot".
- Anropsställen (`pengar.tsx` FixedCard, `attgora.tsx`, `ReceiptScanner.tsx`) invaliderar även `finance_accounts` i React Query så saldot uppdateras direkt.
- Ingen ändring i `spend_entries`, `buildBudget` eller `spend-breakdown` – fasta betalningar förblir separata från köp.

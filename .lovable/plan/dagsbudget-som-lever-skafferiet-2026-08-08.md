# Dagsbudget som lever + Skafferiet

## 1. Pengar per dag nollställs varje dygn

- Widgeten räknar om sig själv vid midnatt (svensk tid): saldo på alla konton minus kvarvarande fasta utgifter, delat med antal dagar kvar till nästa påfyllning.
- "Att spendera idag" = dagsbudgeten minus det du redan registrerat idag. Vid 24.00 börjar dagen om på ny summa.
- En intern timer gör att siffran byter dag utan att du behöver ladda om appen.

## 2. Utgift drar från kontot

- När du registrerar ett köp och väljer konto minskas det kontots saldo direkt med beloppet.
- Ändrar du beloppet, byter konto eller tar bort en post justeras saldot tillbaka på motsvarande sätt.
- Eftersom dagsbudgeten bygger på saldot faller "kan göras av per dag" automatiskt när du handlar.

## 3. Spargris i kalendern

- Varje dag som passerat får en liten gris i kalendern:
  - grön gris med plusbelopp om du spenderat mindre än dagsbudgeten,
  - röd gris med minusbelopp om du spenderat mer.
- Grisen visas i dag-, vecko-, månads- och agendavyn och räknas fram ur utgifterna – inget extra behöver läggas in manuellt.

## 4. Skafferiet under Handla

- Alla varor som Andrea läser av från kvitton hamnar i "Skafferiet" i stället för att åka rakt in i inköpslistan.
- Tryck på en vara i Skafferiet för att lägga den i inköpslistan.
- Vid varje vara står hur många dagar sedan du köpte den ("3 dagar sedan", "Idag").
- Skafferiet ligger som eget kort på Handla-sidan, med sökfält och möjlighet att ta bort varor.

## Tekniskt

- **Databas:** ny kolumn `last_purchased_at` på `pantry_items` (fylls när en vara läses av från ett kvitto) så att "dagar sedan" blir korrekt även när varan senare läggs i listan.
- **`src/lib/finance.ts`:** `buildBudget` utökas med `spentToday` och `todayLeft`; ny hjälpfunktion som ger dagssaldo per datum (dagsbudget − spenderat den dagen) till kalendern. Ny tick-hook som triggar omräkning vid midnatt (`Europe/Stockholm` via `src/lib/tz.ts`).
- **Kontosaldo:** utgiftsmutationerna i `finance.ts` (skapa/ändra/ta bort) uppdaterar `finance_accounts.balance` för valt konto och invaliderar `finance_accounts`-queryn.
- **`src/components/dashboard/MoneyWidget.tsx`:** visar "Att spendera idag" överst och dagsbudget som sekundär rad.
- **Kalender:** ny liten komponent `PiggyMarker` som renderas i dagcellerna i `src/routes/_authenticated/kalender.tsx`; färgtoken för grön/röd finns redan i designsystemet.
- **`src/components/pengar/ReceiptScanner.tsx`:** skickar avlästa dagligvaror till `pantry_items` (med `last_purchased_at`) i stället för `useAddItems` mot listan.
- **`src/lib/shopping.ts` / `src/routes/_authenticated/handla.tsx`:** ny `useSavePantry`/`useDeletePantryItem` och ett `PantryCard` ("Skafferiet") som listar varor med dagar sedan köp och lägger till i listan vid tryck.

# Betalda fasta utgifter – månad för månad

## Vad du får

**Markera som betald**
- Varje rad under Fasta utgifter får en "Betald"-knapp. Klickar du den räknas posten som betald för innevarande månad: den gråas ut, får en bock och "Betald 19 aug", och räknas inte längre med i "Fasta kvar" eller i dagsbudgeten.
- En betald post kan ångras (klick igen) om du markerade fel.
- Vid månadsskiftet nollställs allt automatiskt – posten dyker upp som obetald igen den 1:a.

**Fakturor som betalar sig själva**
- När du laddar upp en faktura under Pengar läser Andrea av mottagare, belopp och betalningsdatum som vanligt. Nytt: hon jämför fakturan mot dina fasta utgifter och föreslår matchning ("Det här ser ut som Hyra 9 000 kr – markera som betald för augusti?").
- Matchningen är smart: den tittar på namnlikhet (Hyra / hyresavi / bostadsbolagets namn), belopp inom rimlig marginal, och rätt månad – inte bara exakt textmatch.
- Godkänner du förslaget markeras posten betald med fakturans betalningsdatum, även om det ligger före den vanliga förfallodagen. Hyran betald idag försvinner alltså från Fasta utgifter fram till den 1:a nästa månad.
- Är matchningen entydig (samma namn och samma belopp) sker den automatiskt med en notis du kan ångra.

**Obetalt följer med till nästa månad**
- Är en fast utgift fortfarande obetald när månaden tar slut skapas en uppgift under Att göra: "Obetald: Hyra 9 000 kr (juli)" – utan slutdatum, men skriven i rött så den sticker ut.
- Uppgiften försvinner automatiskt när du markerar posten som betald (i Pengar eller genom att bocka av uppgiften) – de två hålls i synk åt båda håll.
- Restskulden räknas fortsatt med i "Fasta kvar" tills den är betald, så dagsbudgeten inte blir för optimistisk.

**Tydligare kort**
- Fasta utgifter visar "3 av 6 betalda · 4 200 kr kvar denna månad" överst, och obetalda poster som passerat sin förfallodag markeras i rött.

## Tekniska detaljer

- Migration: `fixed_expense_payments` (`id`, `user_id`, `expense_id` → `fixed_expenses`, `period` text `YYYY-MM`, `paid_on` date, `amount` numeric, `source` text: `manuell` | `faktura` | `ai`, `file_id` nullable, `todo_id` nullable, unique på (`expense_id`, `period`)). GRANT till `authenticated`/`service_role`, RLS på `auth.uid()`, `updated_at`-trigger.
- `src/lib/finance.ts`: `usePaidFixed()`-hook, `periodKey(date)`, och `buildBudget` filtrerar bort poster som har betalning för aktuell period, samt lägger till obetalda poster från tidigare perioder i `fixedLeft`.
- `src/lib/fixed-expenses.ts` (ny): rendering-hjälpare – status per post (betald/obetald/försenad/restskuld), summering, och matchningspoäng mot fakturor.
- `src/lib/finance.functions.ts`: `markFixedPaid` / `unmarkFixedPaid` (skapar/tar bort betalningsrad och stänger/öppnar kopplad todo), `matchInvoiceToFixed` (serverfunktion som skickar fakturans text + listan över fasta utgifter till Lovable AI och returnerar `{ expenseId, confidence, reason }`), och `carryOverUnpaidFixed` som körs vid inläsning av Pengar-sidan och skapar röda todos för föregående månaders obetalda poster.
- `src/lib/finance-ai.server.ts`: utökat schema med `payment_date` och `recipient` för fakturor, plus `matchFixedExpense`-anropet.
- `src/components/pengar/ReceiptScanner.tsx`: när `kind === "faktura"` visas matchningsförslaget med Godkänn/Avbryt innan sparning.
- `src/routes/_authenticated/pengar.tsx`: `FixedCard` byggs ut med betald-knapp, status och sammanfattningsrad.
- Todos får `notes`-markör (`fixed:<expenseId>:<period>`) så synk mellan uppgift och betalning fungerar; röd stil renderas i `TodoPlanCard.tsx` och Att göra-listan via befintlig `dueTone`-liknande status.

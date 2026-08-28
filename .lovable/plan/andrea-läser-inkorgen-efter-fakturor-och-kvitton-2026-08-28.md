# Andrea läser inkorgen efter fakturor och kvitton

Andrea går igenom inkommande mejl, plockar ut allt som handlar om pengar (fakturor att betala, kortkvitton, prenumerationsaviseringar) och lägger dem i en **godkännandekö**. Inget hamnar i systemet förrän du sagt ja.

## Så fungerar det

1. **Skanning** – Andrea hämtar de senaste mejlen från Gmail (respekterar dina befintliga mejlregler) och läser ämne, avsändare och brödtext.
2. **Tolkning** – AI klassar varje mejl som ett av:
   - *Faktura att betala* (belopp, mottagare, förfallodatum, OCR/referens)
   - *Betalt med kort / kvitto* (belopp, butik, datum)
   - *Prenumeration* (belopp, intervall, nästa dragning)
   - *Inget ekonomiskt* – ignoreras
3. **Godkännandekö** – Fynden visas i ett nytt kort "Från inkorgen" under **Pengar**, med belopp, avsändare, datum och länk till mejlet. Du väljer Godkänn eller Avfärda per fynd (och kan justera belopp/datum/kategori innan du godkänner).
4. **Vad godkännandet gör:**
   - Faktura att betala → skapas som en **uppgift i Att göra** ("Betala X – 495 kr, förfaller 30/9"), kopplad till fakturan. Uppgiften bockas av automatiskt när posten markeras betald (och tvärtom), samma mekanik som dagens obetalda fasta utgifter.
   - Betalt med kort → registreras som en **utgift** med kategori och konto (förslag från AI, du kan ändra).
   - Prenumeration → föreslås som **fast utgift/prenumeration** med intervall och förfallodag, vilket ger kalendersynk som idag.
5. **Ingen dubblett** – varje mejl-id sparas, så samma mejl föreslås aldrig två gånger, och belopp/datum matchas mot befintliga utgifter och fasta utgifter innan förslag skapas.

## När skanningen körs

- Automatiskt när du öppnar Pengar (max en gång i timmen).
- Manuellt via knappen "Sök i inkorgen" på kortet.
- Andrea får verktyget `scan_mail_for_bills` så du kan säga "kolla mejlen efter räkningar" i chatten. Hon får aldrig godkänna själv – bara lägga i kön och berätta vad hon hittat.

## Teknisk plan

- **Databas:** ny tabell `mail_findings` (user_id, message_id unikt per användare, kind, merchant, amount, due_date, occurred_at, currency, reference, category, account_id, raw_ai jsonb, status pending/approved/dismissed, created_todo_id, created_spend_id, created_expense_id). RLS per `auth.uid()` + GRANT till authenticated/service_role, `updated_at`-trigger.
- **Gmail:** utöka `src/lib/google.server.ts` med `gmailMessageBody(id)` (format=full, avkoda text/plain eller strippad text/html) och `gmailList` med större `max`.
- **AI:** ny `src/lib/mail-scan.server.ts` som kör befintlig Gemini-väg (`google-ai.server` med Lovable-fallback) mot ett strikt Zod-schema per mejl, batchat.
- **Serverfunktioner:** `src/lib/mail-scan.functions.ts` – `scanMailForFinance`, `listMailFindings`, `approveMailFinding`, `dismissMailFinding`. Approve återanvänder `saveFixedExpense`-logiken respektive spend-insert och todo-markören (`fixed:<id>:<period>`-mönstret) så avbockning fungerar likadant.
- **UI:** nytt `src/components/pengar/MailFindingsCard.tsx` inlagt i `src/routes/_authenticated/pengar.tsx`; radvis redigering + Godkänn/Avfärda, samma korttyp som övriga ekonomikort.
- **Andrea:** verktyget `scan_mail_for_bills` i `src/routes/api/chat.ts` (endast läs + köa).

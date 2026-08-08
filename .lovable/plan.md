# Koppla Andrea till Apples + färdigställa agent-rättigheter

## Redan gjort

- AI-kartläggning av dagar: `src/components/platser/DayMap.tsx` visar stopp/resor från positionshistoriken och låter dig godkänna dem.
- Utökade Andreas verktyg i `src/lib/agent.server.ts` och `src/routes/api/chat.ts`:
  - rätta data: `update_todo`, `update_reminder`, `delete_reminder`, `update_case`, `update_case_task`, `update_visit`
  - ekonomi: `finance_overview`, `add_spend`, `set_account_balance`, `save_fixed_expense`
  - kassaskåp: `vault_lookup`, `vault_save`, `vault_delete`
  - personlighet: `remember_about_me`
  - juristappen: `legal_search_cases`, `legal_get_case`, `legal_search_clients`, `legal_search_documents`, `legal_deadlines`
- Andrea är mer personlig: hämtar profil och anpassar ton/rakhet/fokus.
- IPTV: inloggningsuppgifter visas direkt efter att en ny användare skapas.

## Kvar att göra

1. **Apples-koppling**
   - Användaren hämtar Project URL + API Key från projektet "Apples".
   - Sparar dem som `APPLES_SUPABASE_URL` och `APPLES_SUPABASE_KEY` i Cloud → Secrets.
   - Jag verifierar att Andrea kan läsa ärenden/klienter/dokument/deadlines.

2. **Testa hela flödet**
   - Ställa frågor till Andrea om juristärenden.
   - Be Andrea rätta en felaktig händelse/uppgift/besök.
   - Testa kassaskåpet och ekonomi via chatten.
   - Testa IPTV-skapande och att inloggningskortet dyker upp.

3. **Eventuella justeringar**
   - Om något verktyg svarar konstigt eller saknas behörighet justerar vi scheman/prompt.
   - Om Apples-nyckeln är begränsad byter vi till service role eller smalare läsbehörighet.

# Prisbok för skafferiet

Varje gång ett kvitto sparas ska varornas priser lagras i en egen prisdatabas – med butik, datum och pris – och visas i en ny "Prisbok" under Handla. Kampanjpriser flaggas av AI:n och räknas inte in i prisdatan.

## Det här bygger jag

### 1. Ny databastabell `pantry_prices`

- En rad per vara och köptillfälle: vara (kopplad till skafferiet via `pantry_item_id` + kanonisk nyckel), butik, pris, kvantitet (t.ex. "4 st"), inköpsdatum, källa (kvitto/manuellt) och om raden var ett kampanjpris.
- Skyddad med RLS (bara din egen data) och standardbehörigheter, som övriga tabeller.

### 2. Priserna fångas automatiskt vid kvittosparning

- I dag sparas bara varunamnen i skafferiet – priserna kastas bort. Nu skickas även belopp, kvantitet och butik med när kvittot bokförs, och varje vara får en prisrad.
- Gäller både kvittoskannern under Pengar och när Andrea läser ett kvitto i chatten.
- **Kampanjer:** AI-avläsningen får ett nytt fält per vara som markerar kampanjpriser ("Extrapris", "2 för X", kampanjmärkta rader). Kampanjrader sparas i skafferiet som vanligt men får en kampanjmarkering i prisdatabasen och räknas inte in i "normalpriset". I granskningsvyn syns en liten kampanj-badge på raden så du ser vad som exkluderats.
- Rader utan pris eller med pris 0 hoppar över prisdatabasen.

### 3. Nytt kort "Prisboken" under Handla

Placeras under topplistan på Handla-sidan:

- Sökbar lista över alla varor som någonsin fått ett pris: varunamn, **senaste normalpris**, butik och datum.
- Klicka på en vara för historik: alla prisrader kronologiskt med butik och datum, samt lägsta/högsta/snitt-pris. Kampanjrader visas gråade och strukna så du ser dem men de påverkar inte snittet.
- Senaste priset syns även i topplistans detaljvy (under "Antal köp" m.m.).

### 4. Andrea kan svara på prisfrågor

- Nytt verktyg till Andrea: "vad kostar mjölk?" / "vad betalade jag för iste på Lidl?" → hon slår upp senaste pris och historik från prisboken.

## Begränsningar

- Priser byggs upp från och med nu – gamla kvitton finns bara som totalbelopp i utgifterna, så historik kan inte återskapas i efterhand.
- Kampanjdetektering bygger på AI-avläsningen; en kampanj som inte är märkt på kvittot kan inte skiljas från normalpris.

## Tekniskt

- Migration: `CREATE TABLE public.pantry_prices` + `GRANT` (authenticated + service_role) + RLS-policy scopad på `user_id`.
- `src/lib/finance-ai.server.ts`: `is_campaign: boolean` per vara i schema + prompt ("markera kampanj-/extraprismärkta rader").
- `src/lib/shopping.ts` (`useAddPantryItems`) och `src/lib/andrea-files.server.ts` (`addPantryItems`): tar emot prisade varor `{ name, amount, quantity, is_campaign }`, matchar mot skafferiet på kanonisk nyckel och skriver en rad i `pantry_prices` per vara (med butik + datum).
- `src/components/pengar/ReceiptScanner.tsx`: skickar med pris/kvantitet/kampanj för de rader som går till skafferiet; kampanj-badge i granskningslistan.
- Ny `src/components/handla/PriceBookCard.tsx` (sökbar lista + historik-expansion) monterad i `src/routes/_authenticated/handla.tsx`; senaste pris även i `PantryTopCard`-detaljen.
- Nytt Andrea-verktyg `price_lookup` i chat-verktygen.

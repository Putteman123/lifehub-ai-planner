# Bättre inläsning av kvitton och dokument

Exempelkvittot (Lidl, 406,94 kr) visar fem svagheter i dagens flöde: rabattrader (Lidl Plus −10,00, Bonusrabatt −8,90) riskerar att hamna som "varor" i skafferiet, antalsrader ("3,50 x 4") tolkas inte tydligt, kupongdelen längst ner kan hallucineras till varor, adressen kan plockas från sidhuvudet i stället för den fullständiga postadressen, och det finns ingen kontroll att varuraderna verkligen summerar till totalen. Samma avläsare används både under Pengar och när du skickar filer till Andrea i chatten, så förbättringarna slår igenom överallt.

## 1. Smartare AI-avläsning (delad motor)

**Utökat schema i `readReceipt`:**
- Nytt fält `discounts`: rabatter och kuponger som egna rader (namn + negativt belopp), t.ex. "Lidl Plus-rabatt −10,00".
- Antal på varje rad: "Vetefralla 3,50 x 4" → quantity "4 st", amount = radens total 14,00 (aldrig styckpriset).
- Tobakrader får också antal ("MARLBORO Gold TW2 89,00 x 2" → 178,00).
- Betalsätt (Kort/Kontant/Swish) för eventuell visning.

**Skarpare prompt:**
- Uttryckligt förbud mot att läsa marknadsförings- och kupongdelar ("Inlösta kuponger", "Tävla om fina vinster") som varor.
- Adress ska hämtas från kvittots fullständiga postadress (gata + postnummer + ort, som i kvittots sidfot) före sidhuvudets kortform.
- Kassar, pant och avrundning ska varken hamna i groceries eller tobacco.
- Uppdaterad tobaksmärkeslista så märken som Marlboro alltid klassas som Cigaretter även utan ordet "cigaretter" på raden.

**Kontrollräkning (reconciliation):**
- Servern räknar: varor + tobak − rabatter ≈ total. Vid avvikelse > 2 kr markeras svaret med `balanced: false` och diffen, så du ser direkt om avläsningen är tillförlitlig i stället för att upptäcka felet i efterhand.
- Modellen för kvitton byts till den vassare Gemini Flash-varianten som redan används för snabbfilen (bättre på tät, liten kvittotext), med samma snabba svarstid.

**Hårdare filtrering server-side:**
- `isNonGrocery` breddas från exakt matchning till innehållsmatchning ("Lidl Plus-rabatt", "Papperskasse", "Pantretur" fångas alltid) så rabatt-/kasserader aldrig kan läcka in i skafferiet oavsett vad modellen svarar.

## 2. Tydligare granskning under Pengar

- Rabatterna visas som egna rader (med minus) under varulistan, så du ser att de räknats in.
- Ny kontrollrad under varorna: "Varor 247,84 + tobak 178,00 − rabatt 18,90 = 406,94 ✓" i grönt, eller en gul varning med diffen om summan inte stämmer.
- Varor som filtret känner igen som icke-mat (kasse, pant) får "Hoppa över" som förval i stället för Skafferiet.
- Kvittobilden skalas upp till 2048 px på långsidan (från 1600) så liten text på långa kvitton håller sig läsbar för modellen.

## 3. Samma förbättring i Andrea-chatten

- `readAttachmentReceipt` ärver automatiskt det nya schemat. Andreas förslagstext i chatten nämner rabatt, tobaksuppdelning och om summan balanserar: "Jag läste Lidl 406,94 kr – varor 247,84, cigaretter 178,00, rabatt −18,90, summan stämmer. Ska jag bokföra det?"
- Som tidigare sparas inget förrän du bekräftar i chatten.

## Tekniska detaljer

- `src/lib/finance-ai.server.ts`: utökat JSON-schema (discounts, qty, payment), omskriven prompt, balanskontroll, modellbyte till `ANDREA_QUICK_MODEL`.
- `src/lib/pantry-name.ts`: `isNonGrocery` blir innehållsbaserad; rabatt/pant/kasse-varianter tillagda.
- `src/components/pengar/ReceiptScanner.tsx`: rabattrader, balansrad med ✓/varning, smartare standardmål per vara, uppladdningsskala 2048 px.
- `src/lib/andrea-files.server.ts`: nya fält (rabatt, balans) följer med till Andreas svarstext.
- Ingen databasändring behövs. Testkvittot blir Lidl-bilden ovan: förväntat resultat är 12 varor, cigaretter 178,00, rabatt −18,90, total 406,94, adress Gesällgatan 3, 302 55 Halmstad, 2026-08-21 kl 19:21.

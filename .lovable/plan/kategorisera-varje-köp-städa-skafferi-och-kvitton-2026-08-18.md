# Kategorisera varje köp + städa skafferi och kvitton

## Vad som är fel idag (kontrollerat i databasen)

- **Iste finns – men splittrat på tre rader:** "Iste" (2 köp), "Iste citron/lime" (2) och "Iste citron" (1). Var för sig hamnar de långt ner, tillsammans hade de legat topp 5. Samma sak med nuggets ("Nuggets", "Kycklingnuggets", "Kycklingnugget", "Chickennugget") och juice ("Äppeljuice" 5 + "Äppel juice" 2).
- **Orsaken:** varunamn matchas på exakt textnyckel. Andrea skriver namnet olika från kvitto till kvitto (smaksättning, plural, stavning), så varje variant blir en ny vara istället för ett nytt köp på befintlig vara.
- **Dubbletter i utgifterna:** "Maxi ICA Stormarknad Högskolan 404,49 kr" ligger två gånger på 6 aug, och "Cigaretter 89 kr" två gånger den 17 aug (tre sekunders mellanrum). Det finns inget skydd mot att samma kvitto sparas två gånger.
- **Topplistan visar bara de 10 vanligaste** – rimligt, men blir missvisande när samma vara är uppdelad.

## Det här bygger jag

### 1. Kategorifält på kvittot (standardval + per vara)

I kvittovyn under Pengar:

- **Standardmål för hela kvittot:** Skafferiet + utgift · Bara utgift · Annan utgiftskategori.
- **Per vara:** varje inläst rad får en liten väljare – Skafferiet, egen utgiftspost (välj kategori, t.ex. Tobak, Barn, Övrigt) eller Hoppa över. Standardvalet fylls i automatiskt, men går att ändra rad för rad.
- Varor som styrs till en utgiftspost bokförs som egen post med sitt belopp och dras från samma konto; resten av kvittobeloppet blir kvar på huvudposten (samma logik som tobaksuppdelningen redan använder).

### 2. Smartare varumatchning så inget splittras igen

- Ny normalisering av varunamn: gemener, bort med smaksättning/förpackning efter snedstreck eller komma, singularisering av vanliga svenska ändelser samt en synonymtabell (nuggets, iste, juice m.m.).
- När en vara läses in matchas den mot befintliga skafferivaror med den nya nyckeln – kvittot ökar antal köp istället för att skapa en dubblett.
- Topplistan grupperar dessutom på den normaliserade nyckeln vid visning, så gamla varianter aldrig kan dela upp en vara igen.

### 3. Engångsstädning av befintliga data

- Slår ihop varianterna i skafferiet till en vara per produkt, med summerat antal köp och senaste köpdatum bevarat (Iste = 5 köp, Nuggets, Äppeljuice osv.).
- Tar bort de två dubblettutgifterna (Maxi ICA 404,49 kr 6 aug, Cigaretter 89 kr 17 aug).
- Städar även bort tomma/felaktiga skafferiposter som "Plastkasse" och "Papperskasse" (kassar är ingen matvara) så topplistan blir sann.

### 4. Skydd mot dubbelregistrering framåt

- Innan ett kvitto sparas kontrolleras om det redan finns en utgift med samma butik, belopp och datum – då varnar appen och sparar inte igen.
- Snabbknappar (t.ex. Cigaretter 89 kr) blockeras mot dubbeltryck inom några sekunder.

## Tekniskt

- `src/lib/shopping.ts`: ny `canonicalKey()` med synonym-/suffixhantering, används av `rememberItems` och `useAddPantryItems`; matchning sker mot både `name_key` och kanonisk nyckel.
- `src/components/handla/PantryTopCard.tsx`: gruppera rader på kanonisk nyckel innan sortering.
- `src/components/pengar/ReceiptScanner.tsx`: nytt standardmålsfält + per-rad-väljare (mål + utgiftskategori), återanvänder befintlig split-logik för att bokföra separata poster.
- `src/lib/finance.ts` / spara-flödet: dubblettkontroll på butik + belopp + datum.
- Datastädning körs som ett engångs-skript mot databasen (sammanslagning av pantry-rader, borttagning av två dubblettutgifter).

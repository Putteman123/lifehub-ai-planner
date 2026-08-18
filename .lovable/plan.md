# Filer till Andrea + omgjorda Platser

Två delar: Andrea får ta emot bilder och dokument i chatten, och Platser byggs om till en tydlig dagsvy där AI:n kombinerar GPS, kalender och Google Maps för att förstå var du varit.

## Del 1 – Ladda upp till Andrea

**I chatten**
- Ny gem-/plus-knapp bredvid mikrofonen: kamera, bildbibliotek och filer (JPG, PNG, PDF, max 20 MB, flera åt gången).
- Uppladdade filer visas som små kort ovanför skrivfältet innan du skickar, med kryss för att ta bort.
- Filen laddas upp till en ny privat lagringsplats innan analysen, så bilden inte försvinner när samtalet skrollas vidare.

**Vad Andrea gör**
- Hon läser bilden/dokumentet, beskriver vad hon ser och föreslår vad som ska hända – hon sparar aldrig något själv. Du svarar "ja, lägg i kassaskåpet" eller "det där är ett kvitto på 245 kr" i chatten.
- Nya förmågor hon får när du bekräftat:
  - Kvitto/faktura → tolkas som i Pengar (belopp, butik, varor, tobak) och bokförs som utgift, varorna hamnar i skafferiet, butiken markeras på kartan.
  - Dokument, skärmdump eller lösenordsbild → sparas i Kassaskåpet.
  - Ekonomipapper → sparas bland ekonomifilerna.
  - Bild med datum/tid (kallelse, boka-tid-lapp) → förslag på kalenderhändelse eller påminnelse.
  - Bara analys → inget sparas, filen används enbart i samtalet.
- Hon kan även jobba vidare med en redan uppladdad fil senare i samma samtal ("lägg den där bilden i kassaskåpet i stället").

## Del 2 – Platser byggs om

**Ny struktur (fyra flikar)**
1. **Min dag** (öppnas först): datumväljare, karta över dagen och en enda kronologisk tidslinje med stopp och resor. Varje rad visar tid, platsnamn, adress, hur länge, avstånd och färdsätt – med en knapp för att rätta namn eller ta bort. Ingen dubblering mellan "dagens reselogg", "positionshistorik" och "min dag" längre; de slås ihop till en lista.
2. **Statistik**: veckotimmar per platstyp, färdsättsstatistik, trendgraf, vanligaste resvägar, veckans reseplan.
3. **Mina platser**: sparade platser (hem, jobb, jurist …) plus hela besökshistoriken i en sökbar lista.
4. **Inställningar**: live-läge, telefonens automatiska loggning (OwnTracks-adressen), rensa historik.

**Bättre inmatning av data**
- Positioner med dålig noggrannhet eller som ligger på samma punkt som föregående filtreras bort direkt vid mottagning, så loggen inte fylls av skräppunkter.
- Ett pågående besök stängs automatiskt när nya positioner visar att du lämnat platsen – i dag kan besök bli hängande i timmar.
- Dagens kartläggning körs automatiskt när du öppnar Platser (om dagen inte redan analyserats) i stället för att kräva en manuell knapptryckning.

**Smartare AI-tolkning**
- Varje stopp får ett riktigt platsnamn från Google Places (närliggande företag/adress) i stället för enbart en koordinat.
- Varje resa får verklig körsträcka och restid från Google Routes, vilket ger rätt färdsätt (bil, kollektivt, gång/cykel) i stället för gissning på fågelvägen.
- AI:n stämmer av mot kalendern: ett stopp som ligger i tid och plats med en händelse ärver dess titel och kategori ("Jobb", "Tingsrätten", "Barn"), och du får en varning när kalendern säger jobb men GPS säger hemma.
- Hem/jobb känns igen på vanemönster (var du sover, var du är på vardagsförmiddagar) och föreslås som sparade platser om de saknas.
- Höger säkerhet skrivs direkt: när GPS, kalender och Google-platsen pekar åt samma håll sparas besöket automatiskt i platsloggen. Osäkra stopp ligger kvar som förslag med en tydlig "Godkänn"-knapp och en kort motivering från Andrea.

## Tekniska detaljer

- Ny privat lagringsplats `andrea` + policyer; uppladdning från chatten via signerad URL, filen skickas till modellen som bild-/filblock enligt gatewayens multimodala format.
- `src/routes/api/chat.ts`: acceptera `file`-delar i meddelandena, nya verktyg `analysera_fil`, `spara_fil` (mål: kvitto | kassaskap | ekonomi | kalender | ingen).
- `src/components/andrea/Andrea.tsx`: bifogningsknapp, förhandsvisningar, `sendMessage({ text, files })`.
- Återanvänder befintlig logik: `readReceipt`, `logReceiptVisit`, `logReceiptEvent`, vault-/finansuppladdningarna – inga nya kvittotolkare.
- `src/routes/_authenticated/platser.tsx` delas upp i fyra flikkomponenter; nuvarande kort flyttas in oförändrade där de hör hemma.
- `src/lib/visit-tracking.server.ts`: noggrannhetsfilter, dedupe och automatisk stängning av öppna besök.
- `src/lib/day-mapping.server.ts`: Google Places-namn per stopp, Routes-avstånd per resa, kalendermatchning som ny signal i prompten, samt auto-accept av segment med hög konfidens.
- `src/lib/google.server.ts`: ny `placesNearby`-hjälpare via `places/`-prefixet i gatewayen.

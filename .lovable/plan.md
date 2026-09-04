# Stor uppstädning: lugnare app, mer AI-nytta, och platser som funkar

## 1. Varför Platser inte funkar (vad jag vet nu)

Verifierat i databasen just nu:

- Sista positionen från telefonen kom **31 augusti 13:43**. Efter det har bara webbläsarens live-läge (36 st) och manuella "Jag är här" registrerats.
- Nyckeln som skyddar mottagningen finns och adressen svarar korrekt: fel nyckel ger "Unauthorized", rätt anrop tas emot.
- Ett besök ligger fortfarande öppet.

Det betyder att servern är igång men **inget når fram från telefonen**. Orsaken sitter i OwnTracks-inställningen eller i vilken adress som är inlagd — och det går inte att se idag, eftersom avvisade anrop inte syns någonstans.

**Så felsöker jag det:**

- Varje inkommande anrop till platsmottagningen loggas (tidpunkt, resultat: godkänt / fel nyckel / fel format), utan att spara känsliga uppgifter.
- I Platser → Inställningar får du en "Anslutningskontroll": senaste anropet, vad som hände, och en tydlig text som "Telefonen har aldrig hört av sig" eller "Telefonen hör av sig men nyckeln är fel".
- En testknapp som skickar ett testanrop och bekräftar hela kedjan.
- Adressen visas som en komplett rad du kan kopiera med ett tryck, med den stabila publicerade adressen (inte förhandsvisningen), plus en OwnTracks-guide med exakt de fält som ska fyllas i (läge HTTP, URL, "Skicka nu"-knappen, behörighet "Alltid" för platsdata, batterisparläge av).
- Reservväg om OwnTracks fortsätter tiga: en iOS-genväg med automation som skickar position, med samma kopiera-knapp.

När loggen finns kan jag säga exakt var det stoppar och laga det.

## 2. Buggfix och datastädning

- Stäng hängande besök och ta bort nollresor (samma start och mål, 0 meter) automatiskt.
- Dagskartläggningen körs automatiskt när dagen inte analyserats i stället för att kräva ett knapptryck.
- Genomgång av dubbletter: samma händelse från flera kalendrar, samma utgift registrerad två gånger, dubbla inköpsrader.
- Tomma kort ersätts med en kort förklaring och en knapp som gör något.
- Genomgång av felmeddelanden så att inget kort bara blir tomt när något går fel.

## 3. Lugnare gränssnitt

**Startsidan** blir "Idag": en AI-briefing överst, sedan max fyra kort — dagens schema, pengar idag, att göra, och en varningsyta. Allt annat flyttas dit det hör hemma och nås via en "Visa mer"-rad.

**Pengar** behåller flikarna men får en tydligare topp: saldo, kvar till lönedag, månadens resultat. Kort som visar samma sak slås ihop.

**Kalendern** får filter och skiftförklaring hopfällda i en rad i stället för två block, och mötesförslagen flyttas in i dagsvyn.

**Menyn** grupperas: Vardag (Idag, Kalender, Att göra, Handla), Ekonomi (Pengar, Arkiv), Familj & juridik (Barn, Jurist), Verktyg (Platser, IPTV, Kassaskåp). Samma ordning i den flytande menyn.

Genomgående: samma kortstil, samma rubrikstorlekar, samma avstånd på alla sidor.

## 4. Mer AI som gör nytta

- **Daglig briefing** överst på startsidan: Andrea skriver några meningar om dagen — schema, krockar, pengar, vad som bör göras först — med uppläsning och en "Planera om"-knapp.
- **Ekonomicoach**: prognos till lönedag, vad som riskerar att inte gå ihop, vilka fasta utgifter som är på väg, och konkreta sparförslag utifrån dina egna köp.
- **Automatisk städning**: AI föreslår sammanslagningar och rensningar (dubbletter, felaktiga resor, okända platser) i en granskningslista där du godkänner med ett tryck. Inget ändras utan ditt godkännande.

## Tekniskt

- Ny tabell `location_ingest_log` (tid, resultat, källa, ev. felkod) med RLS + GRANT; skrivs från `src/routes/api/public/plats.ts` för alla utfall, även 401.
- Ny serverfunktion i `src/lib/places.functions.ts`: `ingestDiagnostics` (senaste anrop, klassificering) + testanrop.
- `src/lib/visit-tracking.server.ts`: stäng alla öppna besök, blockera nollresor.
- `src/components/platser/OwnTracksGuide.tsx` och `PlacesStatusCard.tsx`: anslutningskontroll, publicerad adress, testknapp, genvägs-alternativ.
- Ny `src/lib/briefing.functions.ts` + `briefing.server.ts` (Gemini först, Lovable som reserv) och `src/components/dashboard/DailyBriefingCard.tsx`.
- Ekonomicoach som serverfunktion i `src/lib/finance-ai.server.ts` + kort i `src/components/pengar/`.
- Städförslag i `src/lib/cleanup.functions.ts` med granskningsvy under Arkiv/Inställningar.
- `dashboard.tsx` (795 rader), `pengar.tsx` (1314) och `kalender.tsx` (547) delas upp i sektionskomponenter; `FloatingNav.tsx` får grupperad meny.

# Tårtdiagrammet ska stämma med "Spenderat i mån."

## Varför det skiljer idag

Diagrammet och nyckeltalet räknar olika saker:

- "Spenderat i mån." (`buildBudget` i `src/lib/finance.ts`) summerar bara registrerade köp från den 1:a i månaden till idag. Inga fasta utgifter.
- Tårtdiagrammet (`spendSlices` i `src/lib/spend-breakdown.ts`) summerar rullande 30/90/365 dagar bakåt och lägger som standard på fasta utgifter.

Därför visar diagrammet 48 893 kr medan toppkortet visar en lägre summa.

## Vad som byggs

1. Ny period "Denna månad" i diagrammet, förvald: från den 1:a i innevarande månad till nu (samma fönster som toppkortet). 30 dagar / 3 mån / 12 mån finns kvar som val.
2. "Räkna med fasta utgifter" blir avstängd som standard. Med den avstängd och perioden "Denna månad" är diagrammets totalsumma exakt lika med "Spenderat i mån.".
3. Diagrammet visar en liten rad under totalen: "Motsvarar Spenderat i mån." när summan matchar, annars en förklaring att perioden/fasta utgifter gör att summan skiljer sig.
4. Kategoridetaljen (klick på en kategori) använder samma period, så drill-down alltid stämmer med diagrammet.

## Tekniskt

- `spendSlices` och `categoryBreakdown` får ta emot ett tidsfönster (start/slut) i stället för enbart `days`; en hjälpfunktion `monthToDateWindow()` ger 1:a i månaden → nu. Befintliga `days`-anrop fungerar vidare.
- `SpendPieCard.tsx`: nytt val i `RANGES` ("Denna månad"), default-state ändras, `withFixed` default `false`, ny hjälptext under totalen.
- `CategoryDetailDialog.tsx`: tar emot samma fönster i stället för `days`.
- `src/lib/spend-breakdown.test.ts` utökas med ett test som verifierar att månadssumman utan fasta utgifter är identisk med `buildBudget(...).spentThisPeriod` för samma data.

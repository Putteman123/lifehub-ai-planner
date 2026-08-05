# Nyp-zoom i hela appen

Du ska kunna nypa med två fingrar var som helst i appen för att förstora, precis som på en vanlig webbsida i Safari.

## Vad som ändras

- Appen tillåter uttryckligen zoom upp till 5x (och tillbaka till 1x), i stället för att förlita sig på webbläsarens standard.
- Fungerar även när appen är startad från hemskärmen som fristående app, där iOS annars stänger av nyp-zoom.
- Fasta element (den flytande menyn, headern, Andrea-knappen) följer med när du zoomar i stället för att ligga kvar och skymma innehållet.
- Sidor kan scrollas i sidled när du zoomat in, så inget innehåll blir oåtkomligt.
- Dubbeltryck-zoom fungerar som vanligt.

## Vad som inte påverkas

- Kartan i Platser behåller sin egen nyp-zoom (kartans zoom, inte sidans).
- Reglage (slider) och scrollytor fungerar som förut.

## Teknisk detalj

- `src/routes/__root.tsx`: viewport-metan blir `width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover`.
- `src/styles.css`: `touch-action: pan-x pan-y pinch-zoom` på `html, body` samt `-webkit-text-size-adjust: 100%`; ingen global `touch-action: none`.
- Fasta lager i `AppShell`/`FloatingNav`/`Andrea` byter från `fixed` till `sticky`/`absolute` beteende via en `@supports`-säker klass så att de skalar med visual viewport i stället för att låsas mot skärmen.
- Kartdialogen behåller `touch-action: none` lokalt så kartans egen gestlogik inte krockar.
- Verifieras i 402×874 med in- och utzoom.

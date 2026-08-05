# Startvyn optimerad för iPhone 16 Pro

Målskärm: 402 × 874 CSS-px. Idag äter den flytande vänstermenyn ca 68 px av bredden, texten är på flera ställen 10–11 px, och ett tiotal kort ligger staplade i en enda lång kolumn. Resultatet är smalt och svårläst.

## 1. Menyn döljs bakom en knapp på mobil

- På mobil visas ingen fast vänstermeny. I headern kommer en menyknapp (hamburgare) som fäller ut navigeringen som en panel över skärmen, med stora träffytor och samma ikoner/etiketter som idag.
- Panelen stängs vid val av sida, vid tryck utanför och med svep.
- Innehållet får därmed full bredd (402 px minus 16 px marginal i stället för dagens ~310 px).
- På surfplatta/dator behålls den flytande vänstermenyn precis som nu.

## 2. Startvyn delas in i flikar

Tre flikar högst upp under rubriken, med sparat val och mjuk övergång:

```text
[ Idag ]   [ Kalender ]   [ Statistik ]
```

- **Idag** – Andreas lägesbild, dagens agenda, ledig tid, kommande, påminnelser, deadlines.
- **Kalender** – veckans tidslinje och månadskalendern (båda fortsatt klickbara).
- **Statistik** – nyckeltal (arbetade timmar, juristtimmar, tid med barnen, möten), platslogg, mest besökta platser, natt-/kvällspass, inkorg.

På dator visas allt som idag i två kolumner – flikarna används bara på mobila bredder.

## 3. Läsbarhet (nivå 3 – balanserad)

- Brödtext går från 13–14 px till 15 px, sekundär text från 10–11 px till 12–13 px. Inga texter under 12 px kvar på mobil.
- Kortens innerpadding jämnas ut och radhöjden ökas något så listorna andas.
- Dagens agenda: tid och titel läggs på två rader på smal skärm i stället för att trängas på en, med större träffyta per rad.
- Veckans tidslinje: 7 kolumner behålls men med tydligare dagsiffra och belastningsprick, utan avhuggen text.
- Månadskalendern: större dagsiffror och max 3 prickar per dag, celler minst 44 px höga så de går att träffa med tummen.
- Kontrast på dämpad text höjs ett steg så den klarar läsning i solljus.

## 4. iPhone-specifikt

- Säkra zoner respekteras uppe (Dynamic Island) och nere (hemindikator), inklusive i den nya menypanelen.
- Inget horisontellt spill: allt innehåll klipps/bryts inom skärmbredden.
- Alla tryckytor minst 44 × 44 px.

## Teknisk sammanfattning

- `src/components/FloatingNav.tsx`: mobilläge byts till en Sheet-panel styrd av en knapp; desktopläget oförändrat.
- `src/components/AppShell.tsx`: vänsterpadding tas bort under `sm`, menyknapp placeras i headern.
- `src/routes/_authenticated/dashboard.tsx`: befintliga sektioner bryts ut till tre grupper som renderas i `Tabs` under `lg`, och i nuvarande tvåkolumnsgrid från `lg` och uppåt. Ingen datalogik ändras.
- Typografi- och padding-justeringar görs med responsiva Tailwind-klasser samt vid behov nya tokens i `src/styles.css`.

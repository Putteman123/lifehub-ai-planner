# LifeHub 3.0 – luftigare, färgrikare gränssnitt

## 1. Nytt utseende

**Färg (Levande Indigo+)**: indigo som bas, plus tydliga accenter — mint/turkos, bärnsten och rosenröd. Varje läge (Kalender, Att göra, Handla, Barn, Jurist, Platser, Kassaskåp) får sin egen färg som syns i:
- färgat band/ikonbricka högst upp i varje kort
- mjuk tonad bakgrund i kortets huvud i stället för dagens helvita ytor
- färgade siffror/pillerformade räknare

**Typsnitt**: Space Grotesk för rubriker, DM Sans för brödtext (redan delvis på plats, laddas korrekt via `<link>` i root-routen).

**Luftighet**: större radavstånd, större radie (18–20 px), tydligare skuggor, minsta tryckyta 44 px, rubriker i större grad. Kompaktheten idag kommer från att allt ligger i hopfällbara `FoldCard` — de behålls men får luft, färgband och större text.

**Layout – bento på startsidan**: fliken "Idag" byggs om till ett bento-rutnät där korten har olika storlek:

```text
+---------------------------+   +-------------+
| Dagens fokus (stort)      |   | Handla (nytt)|
+---------------------------+   +-------------+
+-------------+ +-------------+ +-------------+
| Påminnelser | | Att göra    | | Ledig tid   |
+-------------+ +-------------+ +-------------+
| Kommande (bred)                             |
+---------------------------------------------+
```
På iPhone blir det en kolumn med tydliga färgband; på större skärm 2–3 kolumner. Övriga sidor (Kalender, Att göra, Handla, Platser, Jurist, Barn, Kassaskåp) får samma korthuvuden och luft så helheten hänger ihop.

## 2. Inköpslistan som uppgift på första sidan

- När en inköpslista har varor visas ett eget **Handla-kort** i bentorutnätet: antal kvar, en rad med de närmaste varorna och hela kortet är klickbart → öppnar `/handla`.
- Samma lista visas också som en rad i "Att göra"-kortet, utan datum, märkt med kundvagnsikon i Handla-färgen.
- Kortet försvinner automatiskt när listan markeras som klar (då hamnar den som idag under Påminnelser).
- Ingen ny tabell behövs — den aktiva listan och dess varor läses från befintlig data.

## 3. Ny appikon

Ett abstrakt märke: geometriskt L-format/kalenderfält i indigo-till-mint-gradient med en liten bärnstensgnista, utan transparens (iOS-vänligt). Genereras och skrivs ut i alla storlekar: `favicon.png`, `apple-touch-icon` (152/167/180), `icon-192`, `icon-512` samt maskable-variant, och manifestet uppdateras.

## 4. Så använder du ChatGPT mot LifeHub

Efter implementationen skriver jag en kort guide i appen (Inställningar/Kalendrar-sidan) med konkreta exempel, bl.a.:
- "Vad har jag för pass nästa vecka och när måste jag åka hemifrån?"
- "Lägg till mjölk, bröd och kaffe på inköpslistan."
- "Skapa en uppgift: ringa försäkringsbolaget på fredag."
- "Sammanfatta mina nattpass i augusti och hur många timmar det blir."
- "Var var jag i tisdags och hur länge?"

## Tekniskt

- Tokens i `src/styles.css`: nya accentfärger, större `--radius`, mjukare skuggor; inga hårdkodade färger i komponenter.
- Ny delad `SectionCard`-komponent (färgband + ikon + räknare) som ersätter dagens `FoldCard`-huvud, används på alla sidor.
- `dashboard.tsx`: bento-grid i "Idag"-fliken, nytt `ShoppingTaskCard` som läser aktiv lista via befintliga hooks i `src/lib/shopping.ts`.
- Ikoner genereras och skalas med `magick`, `public/manifest.json` och `__root.tsx` uppdateras.
- Jag åtgärdar samtidigt hydreringsfelet på inloggningssidan.

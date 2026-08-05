# Andrea från "Apples" + flytande vänstermeny + iPhone 16 Pro-optimering

Tre spår: hämta hem Andrea-upplevelsen från AppLex-projektet, byta ut navigationen mot en flytande meny på vänster sida, och se till att allt får plats på en iPhone 16 Pro-skärm utan sidoscroll.

## 1. Andrea som i "Apples"

Andrea behåller LifeHub:s hjärna (samma kalender-/barn-/juristkontext och samma verktyg som idag), men får utseendet och känslan från AppLex:

- **Avatarbild**: hennes porträtt (`andrea-avatar.png`) kopieras över från Apples och används både som knapp och vid varje svar.
- **Flytande knapp**: rund avatar med mjuk guldglöd, grön "online"-prick, pulserande ring och fjädrande in-/utanimation i stället för dagens textpill.
- **Panel**: öppnas som ett glidande fönster (helskärm på mobil, sidopanel på dator) med avatar i toppen och statusrad som växlar mellan "Din AI-guide" och "Tänker…".
- **Meddelanden**: Andreas svar visas med liten avatar bredvid bubblan, avataren får en pulserande glöd medan hon tänker; separat "Tänker…"-bubbla innan första texten kommer.
- **Röst**: mikrofonknapp för att tala till Andrea och uppläsning av hennes svar med "Tysta Andrea"-knapp, byggt på webbläsarens tal-API (samma upplägg som i Apples, inga nya tjänster).
- **Stoppknapp** under pågående svar, rensa historik, och startförslagen behålls.
- Behålls som idag: minne av konversationen lokalt, `goto`-knappar till rätt vy, felmeddelanden på svenska.

Utelämnas medvetet (hör till juristappen): klientväljare, dokumentuppladdning, utkorg/godkännandeflöden, fallback-badge.

## 2. Flytande meny på vänster sida

- Dagens fasta sidopanel och bottennav ersätts av en **flytande vertikal meny** längs vänsterkanten: rundad "pill" med bakgrundsoskärpa, tunn kant och skugga, centrerad vertikalt.
- Ikoner för Översikt, Kalender, Barn, Jurist, Platser, Kalendrar + Lås längst ner. Aktiv vy markeras med fylld bricka.
- På dator expanderar menyn med etiketter vid hovring; på mobil visas bara ikoner (44px tap-targets).
- Innehållet får vänstermarginal så att menyn aldrig ligger över texten, och menyn respekterar safe-area (notch/hemindikator).
- Andrea-knappen placeras i nedre höger hörn så de två inte krockar.

## 3. iPhone 16 Pro – allt på en skärm

Målskärm 402×874 px. Genomgång av alla vyer (Översikt, Kalender, Barn, Jurist, Platser, Kalendrar):

- Ingen horisontell scroll: text tillåts krympa/trunkeras, ikoner låses i storlek, långa länkar bryts.
- Kalenderns vecko-/månadsrutnät anpassas så att alla sju dagar ryms i skärmbredden i stället för att svepa i sidled.
- Rubrikrader byggs om till rutnät (text + knapp) så knappar inte trycker ut innehållet.
- Toppmarginal och botteninnehåll får safe-area-utrymme; onödig vertikal luft minskas så dagens agenda syns direkt utan scroll.
- Verifieras med en riktig rendering i 402×874 för varje vy innan jag är klar.

## Tekniska detaljer

- `src/components/andrea/Andrea.tsx` skrivs om (FAB + panel + röst), ny hjälpfil för tal-igenkänning/TTS. Backend (`/api/chat`, `andrea.server.ts`) rörs inte.
- Avatar kopieras till `src/assets/andrea-avatar.png` och importeras som ES-modul.
- `src/components/AppShell.tsx` ersätter sidebar + bottennav med en `FloatingNav`-komponent; inga nya färger, endast befintliga tokens.
- Animationer görs med CSS/Tailwind (framer-motion installeras bara om det behövs).
- Layoutfixar sker i respektive route-fil under `src/routes/_authenticated/` — endast presentation, ingen logikändring.

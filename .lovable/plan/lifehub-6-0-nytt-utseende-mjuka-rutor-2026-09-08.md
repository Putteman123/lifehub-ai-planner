# LifeHub 6.0 – nytt utseende ("Mjuka rutor")

Hela appen byter från mörkt glas till ljust papper med bläckblå text, varm tegelröd accent och mjuka vita kort med rundade hörn. Inga funktioner, data eller sidor ändras – bara utseendet.

## Så kommer det se ut

- Bakgrund: varmt ljust papper istället för mörkblått.
- Kort: helvita, tydligt rundade, tunn kant och mjuk skugga (ingen glaseffekt, inget norrsken i bakgrunden).
- Text och knappar: djup bläckblå som huvudfärg, tegelröd för det som är viktigt eller brådskande.
- Typsnitt: Outfit för rubriker, Figtree för brödtext.
- Nyckeltal högst upp på Översikt i en tät tvåkolumnsrad (t.ex. "Att spendera idag" med liten stapel, och Andreas lägesbild).
- Flikarna Idag/Kalender/Statistik som en ljus segmentkontroll.
- "Kräver din uppmärksamhet" och dagens händelser som ljusa listrader med färgprick per kategori.
- Andrea-knappen nere till höger blir en mörkblå rund knapp med ljus ram.

## Vad som ändras i koden

- `src/styles.css`: nya färgtoken (bakgrund, kort, primär, accent, ram, kategori- och navigationsfärger), ny skuggdefinition, aurora-bakgrunden tas bort, `card-soft`/`surface-soft` görs om till ljusa ytor utan blur, `.dark`-blocket justeras så det inte ger mörk yta.
- `src/routes/__root.tsx`: laddar Outfit + Figtree istället för Space Grotesk + DM Sans.
- `src/components/SectionCard.tsx`, `AppShell.tsx`, `FloatingNav.tsx`: rundare kort, tunnare kanter, ljusare aktivt läge i navigeringen.
- `src/routes/_authenticated/dashboard.tsx`: nyckeltalsrad överst enligt vald skiss.
- Ca 20 ställen i komponenter/sidor med hårdkodade färger (vit/svart/hex) byts till semantiska token så allt följer nya paletten.

## Kontroll före leverans

Typkontroll, tester och bygge körs, och Översikt fotograferas i iPhone-bredd för att bekräfta att allt får plats utan sidoscroll.

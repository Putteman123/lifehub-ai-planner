# Vårddelen: klart-knappar, kliniskt utseende, navigering och en smartare Andrea

## 1. "Utförd"-knapp för uppgifter och mediciner

- Varje insats i ett besök får en tydlig kryssknapp "Utförd" som sparar vem som klickade och när. I dag finns fältet i databasen men ingen knapp.
- Mediciner får samma knapp ("Given") direkt på brukarkortet och i medicinlistan, inte bara i adminvyn.
- Knappen visas för alla roller i demoväxlaren – Verksamhetsadmin, Personal, Brukare och Anhörig – med en liten text som visar vem som markerade och klockslag. Anhörig och brukare ser samma knapp men markeringen loggas med deras roll.
- Redan utfört visas som grön bock med tidsstämpel och kan ångras samma dag.

## 2. Kliniskt, tydligare utseende i hela vårddelen

- Gemensamma byggstenar: statusbrickor (planerad, pågår, utförd, uteblivet, avvikelse), infokort med ikon, tidslinje för dagen och en lugn färgskala i vit/klinikblå/mjukgrön.
- Ikoner genom hela vårddelen (personal, brukare, schema, karta, insatser, medicin, rapporter) i stället för enbart text.
- Bilder: rubrikbild per flik och porträttplatshållare/initialer per brukare och anställd, i samma stil som de befintliga vårdbilderna.
- Listor blir kort med tydlig hierarki: namn, adress, nästa besök, snabbknappar (navigera, ring, chatt, videosamtal).
- Mobilanpassning: större tryckytor för personal som jobbar i telefonen.

## 3. Navigeringsknapp per brukare

- Varje brukare får en "Navigera"-knapp som öppnar Google Maps med brukarens adress eller sparade koordinater; Waze som alternativ, samma stil som i övriga appen.
- Knappen finns på brukarlistan, brukarkortet, i schemat och på dagens besök.

## 4. Smartare AI i vårddelen

- Dagsöversikt som skrivs av AI: vad som återstår, vilka besök som ligger tajt, vilka mediciner som saknar kvittering, och avvikelser som sticker ut.
- Förslagsruta i schemat: vem som passar bäst för ett obemannat besök, baserat på tidigare besök hos brukaren och restid.
- Automatisk sammanfattning av brukarens vecka, tänkt att kunna delas med anhörig.

## 5. Andrea som komplett assistent – med fokus på brukarrollen

Andrea får vårdkunskap och svarar i brukarens vardagsspråk:

- "När kommer nästa besök?" – tid, vem som kommer och vad som ska göras.
- "Hur ser min dag ut?" – hela dagens plan, mediciner och tider.
- "Ring kontoret" – startar ett Google Meet-samtal med verksamheten och lägger länken i chatten (samma funktion som finns i brukarchatten i dag).
- "Skicka meddelande till personalen" – lägger meddelandet i brukarens chatt.
- "Vilka mediciner ska jag ta idag?" och "Markera som tagen".
- "Vem kom igår?" och "Har något blivit inställt?"
- För personal: dagens rutt, nästa besök, vad som är kvar att kvittera.

Andrea får också en tydlig knapp inne i vårddelen så brukaren hittar henne.

## Tekniskt

- Ny serverfunktion `setVisitTaskDone` (org-scopad, RLS) och migration som lägger till `done_at`, `done_by`, `done_role` på `care_visit_tasks`; motsvarande roll på `care_medication_events`.
- Delade UI-komponenter i `src/components/care/`: `CareStatusBadge`, `CareTaskItem`, `CareClientCard`, `CareSectionHeader` – används av alla flikar under `src/routes/_authenticated/v.f.$slug.*`.
- `NavigateButton` återanvänds; saknas koordinater används adressen som söksträng.
- Bilder genereras i samma stil som `src/assets/care-*.jpg` och importeras som ES-moduler.
- Andreas vårdkontext byggs ut i `src/lib/andrea.server.ts` och `agent-tools.ts` med verktyg för nästa besök, dagsplan, medicinkvittering, meddelande och Meet-start via befintliga `startCareMeet`/`sendCareMessage`.
- Demoföretaget Alfa Demo används för verifiering i alla fyra roller.

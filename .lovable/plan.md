# Alfa 1.0 – undermenyer, demoföretag och intro-film

## 1. Undermenyer under "Vård"

Vårddelen får en tydlig indelning i stället för dagens tre länkar.

Toppnivå (alltid synlig):
- Översikt – nyckeltal för dagen
- Kunder – alla vårdföretag (systemägare)
- Verksamhet – det valda företaget
- Samtal – meddelanden och videosamtal

När man är inne i ett företag visas en andra menyrad:
- Personal
- Brukare
- Schema
- Karta & rutter
- Insatser
- Medicin
- Rapporter

I huvudappens meny blir "Vård" en hopfällbar grupp med genvägar till Översikt, Kunder, Verksamhet och Samtal, så man kommer rätt direkt även från mobilen.

## 2. Demoföretag "Alfa Demo"

Ett nytt komplett företag med egen kortadress (`/v/f/alfa-demo`), fyllt med realistisk data:

- 1 verksamhetsadmin, 4 anställda med olika roller och arbetstider
- 5 brukare med adresser, portkoder, nyckelinfo och anteckningar
- 6 anhöriga kopplade till brukarna med olika samtycken påslagna
- Mediciner per brukare med doser, tider och given-logg bakåt i tiden
- Insatsmallar (dusch, städ, tillsyn, medicin, promenad)
- Besök: två veckor bakåt med genomförda in-/utcheckningar och avvikelser, plus kommande vecka planerad
- Exempelmeddelanden i chatten så samtalsvyn ser levande ut

Allt läggs som en migration med riktiga rader, så demon ser likadan ut varje gång. Ditt befintliga företag och din privata data rörs inte.

## 3. Intro-film som laddningssida

Filmen du laddade upp läggs upp på Lovables mediatjänst och visas som helskärms-intro när appen startar, med mjuk övertoning in i appen. Den spelas utan ljud, kan hoppas över med ett klick och visas bara en gång per besök så den inte stör dagligt arbete.

## 4. Andrea i vårddelen

Andrea får tillgång till vårdkontexten för det företag man är inne i: hon kan svara på frågor om dagens schema, vilka brukare som har besök, mediciner som ska ges och avvikelser. Knappen finns på verksamhetens sidor. Befintlig Andrea i privata appen fungerar som förut.

## 5. Buggtest och namnsättning

- Genomgång av alla vårdsidor med inloggad testsession: personal, brukare, schema, karta, insatser, medicin, rapporter, samtal
- Kontroll att behörigheterna håller: anhörig ser bara sitt, personal bara sitt företag
- Fel som hittas åtgärdas i samma omgång
- Versionen märks "Alfa 1.0" i sidfoten på vårddelen och i översikten

## Tekniska noteringar

- Filmen laddas upp via `lovable-assets` och refereras som `.asset.json`-pekare; ingen binärfil i koden.
- Undermenyerna byggs i `src/routes/_authenticated/v.tsx` och `v.f.$slug.tsx`; nya rutter `v.f.$slug.medicin.tsx` samt `v.f.$slug.personal.index.tsx`/`brukare.index.tsx` för egna listsidor.
- Demodata som en migration med literala INSERT-satser (org, org_members, care_clients, care_relatives, care_medications, care_medication_events, care_task_templates, care_visits, care_visit_tasks, care_messages), idempotent med fasta UUID.
- Intro-filmen renderas i `__root.tsx` med sessionStorage-flagga och `playsInline muted`.
- Andrea-vårdkontext via en ny serverfunktion som hämtar dagens schema/medicin för org och skickas som kontext till befintlig chattväg.
- Krav innan klart: `bunx tsgo --noEmit` grönt och `build OK`.

## Öppen fråga

Demo-personerna läggs in som data. Vill du även ha riktiga inloggningar för demo-admin, personal och anhörig så man kan visa varje roll live? Säg till så lägger jag till det.

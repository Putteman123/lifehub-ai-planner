# Flytta vårdsidan till livo.health

## Så här blir det

- **livo.health** och **www.livo.health** visar landningssidan för vårdsystemet, med en stor **Logga in**-knapp högst upp och i menyn.
- **mellberg.online** fortsätter vara din privata app precis som idag – men "Vård" försvinner ur menyn, så din app blir renodlat privat.
- Demokunderna (Alfa Demo och Care 4 You) följer med automatiskt: de ligger i samma databas, så inget behöver flyttas eller läggas in på nytt.
- Du är redan systemägare i databasen – samma konto, samma superadmin-rättigheter, på den nya adressen.

## Vad jag gör i appen

1. Låter livo.health öppna landningssidan direkt (utan att du skriver /vard), och gör www.livo.health likvärdig.
2. Lägger en tydlig **Logga in**-knapp i sidhuvudet på landningssidan och en stor knapp i första avsnittet.
3. Flyttar företagens korta webbadresser så de fungerar på livo.health, t.ex. alfa-demo.livo.health och care-4-you.livo.health (de gamla på mellberg.online fortsätter fungera).
4. Tar bort "Vård"-länken och dess undermeny ur din privata app.
5. Byter alla länkar som skickas ut i mejl (inbjudan, demo, veckosammanfattning) till livo.health.
6. Anpassar delningslänken för demo så den pekar på livo.health.

## Vad du behöver göra

1. Koppla **livo.health** och **www.livo.health** i Projektinställningar → Domäner (jag visar stegen när planen är godkänd).
2. Vill du att företagsadresserna ska fungera behövs även en jokerpost i DNS för `*.livo.health`.

## Kopplingar och nycklar som måste uppdateras

Inget behöver flyttas i sig – men följande måste godkänna den nya adressen:

| Tjänst | Vad som behöver göras |
| --- | --- |
| Google-nyckeln (Maps, Gemini) | Lägg till `https://livo.health/*` och `https://www.livo.health/*` – eller ta bort webbplatsbegränsningen helt (behövs ändå för AI:n). |
| Google-inloggning / Kalender & Gmail | Lägg till livo.health som tillåten adress och returadress i Google-projektet. |
| Inloggningen i appen | Jag lägger till livo.health som tillåten returadress i backend. |
| Utgående mejl | Avsändardomänen ligger kvar på notify.mellberg.online, men länkarna i mejlen byts till livo.health. Vill du ha avsändare på livo.health behövs nya mejl-DNS-poster. |
| Platsspårning (OwnTracks) | Adressen i telefonen kan bytas till livo.health när domänen är klar; den gamla fortsätter fungera. |
| Aviseringar / hemskärmsapp | Fungerar per adress – installera om appen från livo.health för vårddelen. |
| ElevenLabs (röst) | Inget behövs, den är inte domänbunden. |

## Tekniska detaljer

- `src/server.ts`: lägg till `livo.health` som andra rotdomän, rot och `www` visar `/vard`, företagens kortnamn skrivs om till `/v/f/<slug>` som idag.
- Undanta `/auth`, `/demo`, `/invite`, `/api`, `/v/f/` från omskrivningen även på livo.health.
- `src/lib/nav-theme.ts`: ta bort vård-posten och dess undermeny ur huvudnavigationen.
- `src/lib/care.functions.ts` (`SITE_URL`) och e-postmallarna pekas om till `https://livo.health`.
- `src/routes/_authenticated/v.f.$slug.tsx`: bygg demolänk från livo.health-värden.
- Inloggningens tillåtna returadresser uppdateras i backend-inställningarna.

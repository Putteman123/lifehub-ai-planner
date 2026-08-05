# Tydligare OwnTracks-guide i Platser

Dagens guide är fem korta rader och nämner inte att OwnTracks startar i MQTT-läge – därför syns inget URL-fält. Guiden byggs om till en steg-för-steg-guide som utgår från exakt det du ser i appen.

## Vad som byggs

En ny komponent `OwnTracksGuide` som ersätter den nuvarande OwnTracks-kolumnen i sektionen "Automatisk loggning från telefonen" på Platser-sidan.

Innehåll:

1. **Steg 1 – Installera** OwnTracks (gratis, App Store).
2. **Steg 2 – Byt till HTTP-läge.** Tydlig varning: appen startar i MQTT-läge där fälten heter Host/Port/TLS och något URL-fält inte fungerar. Väg: Inställningar → Läge (Mode) → HTTP.
3. **Steg 3 – Klistra in adressen.** Din privata adress visas/kopieras med en knapp direkt i steget (samma "Visa min privata adress"/"Kopiera" som idag, flyttad hit så den ligger där den används). Adressen visas maskad tills du trycker Visa.
4. **Steg 4 – Autentisering och Lösenord av**, eftersom token redan ligger i adressen.
5. **Steg 5 – Locator: Significant** (batterisnålt) eller Move (tätare loggning).
6. **Steg 6 – Tillåt plats "Alltid"** när iOS frågar, plus tips om att skapa dina platser i LifeHub först så besöken får rätt namn.

Under stegen en liten "Fungerar det?"-rad: en knapp som kollar när senaste positionen togs emot, så du direkt ser om telefonen skickar in data. Samt en kort not om att fälten DeviceID, subTopic, clientId och pubTopicBase bara gäller MQTT och kan ignoreras.

Genvägar-alternativet blir en hopfällbar sektion under, så guiden inte konkurrerar med huvudflödet.

## Tekniska detaljer

- Ny fil `src/components/platser/OwnTracksGuide.tsx`; `src/routes/_authenticated/platser.tsx` renderar den och behåller sin befintliga `showIngest`/`ingestUrl`-logik som props.
- Statuskontrollen använder befintlig platsdata (senaste ping/besök) som redan hämtas på sidan – ingen ny databasfråga eller migrering.
- Ren UI-ändring: webhooken `/api/public/plats` och all backend-logik rörs inte.

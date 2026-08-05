# Visa hela länken direkt i Platser

Idag ligger din privata OwnTracks-adress bakom knappen "Visa min privata adress". Den ska istället stå utskriven i klartext direkt när du öppnar Platser, så du alltid ser hela länken.

## Vad som ändras

- Adressen hämtas automatiskt när sidan laddas – ingen knapp att trycka på först.
- Hela länken visas i klartext i steg 3 i OwnTracks-guiden, i en ruta som bryter raden så inget klipps av.
- "Kopiera adressen" ligger kvar bredvid, plus en liten notis om att adressen är privat.
- Samma klartextvisning på huvudkortet "Automatisk loggning från telefonen".
- Om servern saknar token visas ett tydligt felmeddelande istället för en tom ruta.

## Tekniskt

- `platser.tsx`: hämta ingest-URL:en direkt vid laddning (istället för vid knapptryck) och skicka in den till guiden.
- `OwnTracksGuide.tsx`: ta bort "Visa min privata adress"-läget; rendera alltid `<code>{ingestUrl}</code>` med `break-all`, behåll kopieringsknappen.
- Ingen ändring i backend eller i hur token genereras.

# Rensa domänberoenden

## Vad jag hittade

Genomsökning av hela projektet visar att appen redan är domän-neutral i koden:

- Face ID sparar och filtrerar passnycklar på aktuell värdadress (`rp_id`), inte på en fast domän.
- Google Maps läser nyckel från miljövariabler och visar felmeddelande med `window.location.hostname` dynamiskt.
- Inga URL:er till `mellberg.online` eller `lifehub-ai-planner.lovable.app` finns hårdkodade i källkoden, PWA-manifest eller konfiguration.

Den enda kvarvarande referensen är en kommentar i inloggningskoden som nämner `app.mellberg.online` som exempel.

## Vad jag ändrar

1. Skriv om kommentaren i `src/lib/login-passkey.functions.ts` så den beskriver principen (passnycklar är bundna till domänen) utan att namnge någon specifik domän.
2. Snabbkontroll av att inga byggartefakter, manifest eller MCP-/OwnTracks-guider innehåller fasta domäner — de bygger på aktuell adress vid körning.

## Resultat

Appen fungerar identiskt på Lovable-URL:en och på vilken framtida domän som helst; Face ID registreras per domän och kartan förklarar tydligt om nyckeln saknar behörighet för domänen.

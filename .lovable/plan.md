# Fixa "URI or file configuration not allowed"

OwnTracks vägrar hämta inställningar från en webbadress om appen inte tillåter fjärrkonfiguration. Därför visas rutan när du trycker på knappen. Lösningen är att skicka med inställningarna direkt i länken i stället för att peka på en adress, plus en tydlig reservväg.

## Så blir det för dig

I Platser → Inställningar, kortet "Anslut telefonen":

1. **Öppna i OwnTracks** använder nu en länk som innehåller hela inställningen i sig själv. OwnTracks frågar "vill du importera?" och du svarar Ja – ingen hämtning från nätet behövs.
2. Om rutan ändå dyker upp visas en kort text: tryck **Fortsätt**, gå till OwnTracks inställningar och slå på fjärrkonfiguration, tryck sedan på knappen igen.
3. **Ladda ner inställningsfil** som reserv: filen sparas och du öppnar den i OwnTracks via Dela/Öppna i. Fungerar även när länkar blockeras.
4. QR-koden får samma självbärande innehåll som knappen.

## Teknisk lösning

- `src/lib/places.functions.ts`: bygg konfigurationsobjektet på servern (samma innehåll som i `otrc.ts`, delat i en liten hjälpfunktion), base64-koda JSON och returnera `owntracksLink = owntracks:///config?inline=<base64>` utöver befintlig `otrcUrl` (behålls som nedladdnings-/reservlänk). Gäller `getIngestInfo`, `rotateIngestToken` och `setLocatorMode`.
- `src/routes/api/public/otrc.ts`: oförändrad funktion, men konfigurationen läses från den delade hjälpfunktionen så länk och fil alltid är identiska.
- `src/components/platser/OwnTracksSetupCard.tsx`: knappen använder `owntracksLink` (inline), QR-koden kodar samma inline-länk, ny knapp "Ladda ner inställningsfil" som öppnar `otrcUrl`, och en hjälprad som förklarar vad man gör om OwnTracks nekar importen.

## Verifiering

Typkontroll och build. Inline-länkens innehåll kontrolleras genom att avkoda base64 och jämföra med `.otrc`-svaret.

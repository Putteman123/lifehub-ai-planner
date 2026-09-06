# Få OwnTracks att fungera igen

## Det som är fel i bilderna

- **HTTP är valt** – det är rätt.
- **Adressen ligger i rätt URL-fält** och **Autentisering är av** – också rätt.
- **Nyckeln i URL:en verkar vara inklistrad två gånger efter varandra.** Då blir adressen ogiltig och mottagningen avvisar den.
- **Status “inaktiv” betyder att OwnTracks inte skickar.** Databasen bekräftar detta: det finns inget lyckat OwnTracks-anrop efter 31 augusti. Det enda nya kontrollanropet är appens eget test den 4 september, inte ett positionsanrop från telefonen.
- Eftersom den privata nyckeln syns i skärmbilden ska den bytas, inte återanvändas.

## Åtgärd

1. **Byt den privata mottagningsnyckeln** och låt appen visa en helt ny OwnTracks-adress. Den gamla adressen slutar fungera.
2. **Gör kontrollen verklig:** appens test skickar ett korrekt OwnTracks-liknande POST-anrop till den publicerade adressen, utan att skapa en falsk resa eller plats.
3. **Förbättra mottagningen** så den känner igen vanliga OwnTracks-format och loggar tydligt om felet är adress, nyckel, innehåll eller utebliven kontakt.
4. **Ersätt den långa guiden med en kort reparationsvy:**
   - radera hela nuvarande URL i OwnTracks,
   - tryck “Kopiera ny adress” i LifeHub och klistra in den exakt en gång,
   - Mode = HTTP, Autentisering = av,
   - Locator = Significant eller Move,
   - iPhone: Plats = Alltid, Exakt plats = på, Bakgrundsuppdatering = på,
   - skicka en position manuellt från OwnTracks.
5. **Visa resultat direkt i LifeHub:** “position mottagen”, tidpunkt och källa; annars ett konkret fel och nästa åtgärd. Statusen ska inte säga att allt fungerar bara för att adressen svarar på ett vanligt webbanrop.
6. **Verifiera hela kedjan** med ett säkert test och därefter kontrollera att ett riktigt anrop från telefonen syns som `telefon` i platsloggen.

## Viktigt

Kodändringarna kan göra mottagningen och felsökningen robusta, men inställningen på iPhone måste rättas en gång genom att ersätta den dubbla URL:en med den nya adressen.

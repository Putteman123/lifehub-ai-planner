# Tydligare OwnTracks-guide: var adressen ska ligga

## Vad användaren frågar
Användaren vill se på ett enkelt sätt var i OwnTracks den privata adressen ska klistras in, och undrar om inställningarna på skärmbilden är rätt.

## Bedömning av skärmbilden
Skärmbilden visar rätt konfiguration:
- **Mode = HTTP** (inte MQTT).
- **URL-fältet** längst ner innehåller adressen med token.
- **Autentisering = av** och **Lösenord = av**.
- **Status: inaktiv** är normalt tills en position skickas – antingen automatiskt vid rörelse eller manuellt via skicka-knappen i OwnTracks.

Det enda som kan vara fel är om URL:en är klippt eller kopierad ofullständigt. Då får servern “fel nyckel” eller “ingen nyckel”.

## Vad som ändras

1. **Visuell markering i steg 3**
   - I `src/components/platser/OwnTracksGuide.tsx` ersätts texten “Klistra in din privata adress i fältet URL” med en tydligare rubrik och en visuell “etikett” som pekar ut URL-fältet längst ner i OwnTracks-inställningarna.
   - Lägg till en kort punktlista under adressen:
     - Öppna **Inställningar → Läge** och välj **HTTP**.
     - Hitta fältet **URL** längst ner på sidan.
     - Klistra in hela raden ovan – inklusive allt efter `?token=`.
     - Stäng av **Autentisering** och **Lösenord**.

2. **Inställningschecklista**
   - Lägg till ett nytt litet kort i guiden med fem kryssrutor som visar korrekta värden:
     - Mode: HTTP
     - URL: hela din privata adress
     - Autentisering: av
     - Lösenord: av
     - Platsbehörighet i iOS: Alltid
   - Markera automatiskt de punkter vi kan kontrollera (HTTP-läge, autentisering av) så användaren ser vad som ska vara på/av.

3. **Förklara “Status inaktiv”**
   - Lägg till en kort notis i guiden: “Status inaktiv i OwnTracks betyder inte att det är fel – bara att ingen position skickats än. Gå ut och rör på dig, eller tryck på skicka-ikonen uppe till höger i OwnTracks.”

4. **Kopiera-knappen förblir kvar**
   - Behåll den befintliga kopiera-knappen och varningen om att adressen är privat.

## Resultat
Användaren ser direkt att URL-fältet är det längst ner i OwnTracks, får en checklista över rätt inställningar och slipper oroa sig för “Status inaktiv”.

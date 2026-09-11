# E-post och kalender som verkligen skickar

Idag finns kopplingarna till ditt Google-konto, men inget i appen använder dem för att skicka: inkorgskortet visar bara mejl, och händelser du lägger in stannar i LifeHub. Det här fixas i tre delar.

## 1. Skicka mejl från appen

- Ny knapp "Skriv mejl" på inkorgskortet, plus "Svara" på varje mejl (mottagare och ämne förifylls med "Sv: ...").
- Ett litet fönster med mottagare, ämne och text. Knappen "Skicka" skickar via ditt Gmail och bekräftar med en notis; fel visas i klartext.
- Andrea får verktyget "skicka mejl": hon skriver förslaget, du ser mottagare/ämne/text i chatten och trycker Godkänn innan det går iväg.

## 2. Händelser skrivs till Google Calendar

- I händelsefönstret väljer du kalender som vanligt. Väljer du en Google-kalender skapas händelsen även i din riktiga Google-kalender direkt när du sparar.
- Kopplingen sparas så att en senare synk inte skapar dubbletter, och redigering/borttagning i LifeHub uppdaterar Google-händelsen.
- Andrea bokar i Google-kalendern direkt utan att fråga, enligt ditt val.

## 3. Appens egna notismejl

Kräver en avsändardomän du äger (t.ex. notify.mellberg.online). När den är på plats:

- Veckosammanfattning och viktiga påminnelser (fasta utgifter som förfaller, IPTV som går ut) skickas som mejl till dig.
- Mallarna får samma utseende som appen; du kan slå på/av varje utskick under Inställningar.

Om du hellre vill nöja dig med Gmail-utskick i steg 1 kan vi hoppa över den här delen.

## Tekniskt

- `sendMail` och `createGoogleEvent` finns redan i `src/lib/google.functions.ts` / `google.server.ts` men saknar anropare.
- Nytt: `src/components/google/ComposeMailDialog.tsx` kopplat till `InboxCard`; verktyget `gmail_send` i `src/routes/api/chat.ts` med godkännandeflöde.
- Ny serverfunktion `pushEventToGoogle` som anropas från `EventDialog`-sparningen när `calendars.source = "google"`; Google-händelsens id sparas i `events.external_id`, uppdatering/radering via PATCH/DELETE mot samma id. Synken i `calendar-sync.functions.ts` hoppar över rader som redan finns.
- Gmail-sändning kräver scopet `gmail.send`; om Google svarar 403 om saknad behörighet begärs en ny godkännande-runda för Google-kopplingen.
- Notismejl: e-postdomän sätts upp först, sedan mallregister + serverfunktion som skickar veckosammanfattning och varningar.

## Ordning

1. Mejlutskick i appen + Andrea-verktyg med godkännande.
2. Kalenderskrivning till Google (skapa, ändra, ta bort).
3. Domänuppsättning och appens notismejl.

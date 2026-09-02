# Bättre mejlinläsning + förslag på mötestider

Andrea missar kvitton idag av tre skäl: sökfrågan är för smal (bara några svenska ord), hon läser max 15–25 mejl per svep och hon läser bara brödtexten – kvitton och fakturor som ligger som PDF eller bild i bilagan blir osynliga. Dessutom skannas samma 30 dagar om och om igen, så äldre mejl aldrig hinner bli lästa.

## Del 1 – Träffsäkrare inläsning

- **Flera sökningar istället för en.** Andrea kör en svep-serie: kvitton ("kvitto", "ditt köp", "orderbekräftelse", "tack för din beställning", "receipt", "order confirmation"), fakturor ("faktura", "räkning", "avi", "påminnelse", "invoice", "att betala", "OCR"), betaltjänster (Klarna, Swish, Swedbank Pay, PayPal, Stripe, Apple, Google Play) samt Gmails egen kategori för köp. Dubbletter filtreras bort.
- **Fler mejl per svep.** Upp till ~120 mejl per körning, sidvis hämtning istället för dagens tak på 25.
- **Bilagor läses.** PDF och bilder (jpg/png/heic) i mejlen skickas till AI för avläsning – det är där de flesta kvitton och fakturor faktiskt finns. Max ~3 bilagor per mejl och en storleksgräns så kostnaden hålls nere.
- **Minne över lästa mejl.** Varje mejl-id sparas även när det inte innehöll något ekonomiskt, så samma mejl inte läses om vid nästa svep. Det gör att skanningen betar av inkorgen bakåt i tiden istället för att fastna på de senaste 30 dagarna.
- **Snålare AI.** Uppenbara nyhetsbrev/reklam sållas bort med enkla regler innan AI körs, och klassificeringen körs i mindre batchar.
- **Tydligare status.** Kortet "Från inkorgen" visar när senaste svepet gjordes, hur många mejl som lästes och en knapp "Sök längre bakåt" (90 dagar).

## Del 2 – Förslag på mötestider

- Nytt kort **"Föreslagna tider"** på Kalender-sidan. Du anger längd (30/60/90 min) och eventuellt önskad period; Andrea räknar fram tre lediga tider utifrån dina kalendrar, dina vanliga arbetstider och restid till platsen om den är känd.
- Varje förslag har knappen **Boka**, som lägger in händelsen direkt (kategori föreslås automatiskt), samt **Kopiera text** för att klistra in i ett mejlsvar.
- **Mötesförfrågningar i mejl** fångas i samma svep som ekonomifynden: mejl av typen "kan vi ses i veckan?" hamnar i godkännandekön med tre föreslagna tider. Godkänner du en tid skapas händelsen; inget bokas utan ditt ja.
- Andrea får verktyget `suggest_meeting_times` så du kan fråga i chatten: "när kan jag ta ett möte på en timme nästa vecka?".

## Teknisk plan

- **Databas:** ny tabell `mail_seen` (user_id, message_id unikt, scanned_at, had_finding) för att hoppa över redan lästa mejl. `mail_findings` utökas med `kind = 'mote'`, `suggested_slots jsonb` och `attachment_names text[]`. RLS per `auth.uid()` + GRANT till authenticated/service_role.
- **Gmail (`src/lib/google.server.ts`):** `gmailListPaged(query, max)` med `pageToken`; `gmailAttachments(id)` som hämtar bilagor (`messages/attachments/get`) och returnerar base64 + mimetype med storleksgräns.
- **Skanning (`src/lib/mail-scan.server.ts`):** ny `QUERIES`-lista med flera svep, prefilter mot avsändare/rubrik, batchad klassificering och multimodal input (PDF/bild som `file`/`image_url`-block via befintlig `ai-complete.server`-väg, Gemini först och Lovable AI som reserv). Mötesklassen läggs till i schemat tillsammans med föreslagna tider från `findFreeSlot`.
- **Serverfunktioner:** `scanMailForFinance` får `days`-parameter; `approveMailFinding` hanterar `kind = 'mote'` genom att skapa event via befintlig event-insert + kalendersynk.
- **Möten:** ny `src/lib/meeting-slots.ts` (rena beräkningar ovanpå `findFreeSlot` i `src/lib/calendar.ts`) och `src/components/calendar/MeetingSlotsCard.tsx` inlagt i `src/routes/_authenticated/kalender.tsx`, i Aurora Glass-stil.
- **Andrea:** verktyget `suggest_meeting_times` i `src/routes/api/chat.ts` (endast förslag – bokning kräver att du trycker Boka eller ber henne uttryckligen).

# Få Andrea att fungera igen

## Bekräftad orsak

- ElevenLabs-nyckeln finns och de cirka 131 000 röstkrediterna gäller endast uppläsningen av Andreas svar.
- Andreas tänkande och textsvar går via Lovable AI Gateway, som har **128,38 användbara krediter** i arbetsytan.
- En separat aktiv månadsgräns på **4 AI-krediter** blockerar ändå all användning. Förbrukningen har passerat gränsen och de senaste anropen till både Gemini och GPT stoppades med HTTP 403 `credit_hard_block_workspace`.
- Appen bygger utan fel, så den konkreta blockeringen ligger i kreditgränsen — inte i ElevenLabs-saldot.

## Åtgärder

1. **Lås upp Andrea**
   - Höj den befintliga månadsgränsen för AI Gateway från 4 till **100 krediter**, enligt ditt val.
   - Behåll gränsen aktiv som kostnadsskydd.

2. **Verifiera hela kedjan**
   - Skicka ett riktigt testmeddelande genom Andrea och kontrollera att routeranropet och det efterföljande GPT-anropet lyckas.
   - Testa ElevenLabs-rösten separat så att ett lyckat textsvar också läses upp.
   - Kontrollera att senaste gateway-loggen inte längre visar 403.

3. **Rätta den missvisande statusvisningen**
   - Separera status för **Andrea AI** och **ElevenLabs-röst** så att ElevenLabs-krediter aldrig presenteras som om de kunde låsa upp text-AI:n.
   - Visa den verkliga aktiva AI-gränsen, aktuell AI-förbrukning och tillgängligt AI-saldo i stället för att härleda ett falskt exakt saldo från ett probe-anrop.
   - Visa ElevenLabs som en egen tjänst med fungerande/ej fungerande status och tydligt fallbackläge.

4. **Gör felhanteringen robust**
   - Stoppa automatiska återförsök vid 402/403; statuskontrollen ska inte själv skapa extra blockerade AI-anrop.
   - Behåll manuellt återupptag och handsfree-läge efter fel.
   - För TTS: returnera ElevenLabs-felets riktiga typ till klienten innan webbläsarrösten används som sista fallback.

## Berörda delar

- Arbetsytans befintliga AI Gateway-gräns
- `src/lib/ai-credits.server.ts` och dess serverfunktionsgräns
- `src/components/andrea/Andrea.tsx`
- `src/routes/api/tts.ts` och `src/lib/voice.ts`

## Godkännandekriterier

- Andrea ger ett komplett textsvar utan 403.
- ElevenLabs spelar upp svaret med den konfigurerade rösten.
- Statuskortet skiljer tydligt på AI Gateway och ElevenLabs.
- Statuskortet visar 100-kreditgränsen och aktuell AI-förbrukning utan uppskattade eller påhittade saldon.
- Ett tjänstefel visar rätt feltyp och orsakar ingen automatisk retry-loop.

# Andreas röst: använd ElevenLabs-rösten "Andrea"

## Nuläge (bekräftat)

- Röstuppläsningen i Andrea-chatten går redan via ElevenLabs (`src/routes/api/tts.ts`), med `ELEVENLABS_API_KEY` som finns sparad i projektet.
- Idag används standardrösten "Charlotte" (`XB0fDUnXU5powFXDhCwa`) om inte miljövariabeln `ELEVENLABS_VOICE_ID` är satt.
- Rösten "Andrea" är en röst på ditt ElevenLabs-konto, men dess röst-ID känner vi inte — därför löser appen upp den automatiskt på namn.

## Ändring

1. **Automatisk röstupplösning i `src/routes/api/tts.ts`:**
   - Vid första uppläsningen hämtas röstlistan från ElevenLabs (`GET /v1/voices`).
   - Rösten vars namn är "Andrea" (skiftlägesokänsligt) väljs; resultatet cachas i minnet så att listan inte hämtas vid varje uppläsning.
   - Prioritetsordning: `ELEVENLABS_VOICE_ID` (om satt) → rösten "Andrea" → nuvarande standardröst. Appen blir aldrig tyst.
   - Befintligt beteende behålls i övrigt: `eleven_flash_v2_5`, svenska (`language_code: "sv"`), strömmat mp3-ljud, fallback till Lovables röst om ElevenLabs inte svarar.

2. **Synlig status:** `GET /api/tts` (statuskortet) utökas att rapportera vilken röst som valts (namn + ID), så vi kan verifiera att "Andrea" verkligen hittades.

## Verifiering

- Anropa status-endpointen inloggad och kontrollera att vald röst är "Andrea".
- Skicka ett test-TTS-anrop och bekräfta att ljud returneras (HTTP 200, `audio/mpeg`).
- `bunx tsgo --noEmit` grönt + build OK.

## Om rösten inte hittas

Om inget röstnamn matchar "Andrea" på kontot faller appen tillbaka på standardrösten och jag meddelar dig — då kan du antingen döpa om rösten i ElevenLabs eller ge mig röst-ID:t så lägger jag in det som `ELEVENLABS_VOICE_ID`.

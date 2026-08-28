# Andrea 5.0 – starkare, mer befogenhet och riktig röst

## 1. Riktig röst (ElevenLabs)

- Du lägger in `ELEVENLABS_API_KEY` i en säker ruta när jag börjar bygga.
- Uppläsningen byter från dagens robotröst till ElevenLabs med en naturlig svensk kvinnoröst (flerspråkig modell, låg latens-varianten så hon svarar snabbt).
- Ljudet strömmas i bitar så hon börjar prata efter någon sekund i stället för att vänta ut hela svaret.
- Om ElevenLabs inte svarar faller hon tyst tillbaka på dagens röst – aldrig tystnad.

## 2. Handsfree-samtal: hon lyssnar medan hon pratar

Idag stannar mikrofonen i praktiken när hon talar, därför fungerar inte "tyst".

- Mikrofonen är igång hela tiden, även under uppläsning.
- Säger du "tyst", "stopp", "sluta", "vänta" eller "okej okej" tystnar hon direkt mitt i meningen.
- Säger du något annat medan hon pratar avbryts uppläsningen och hon svarar på det nya i stället (barge-in, som ett riktigt samtal).
- Hennes eget ljud filtreras bort så hon inte svarar på sig själv.
- Tydlig status: Lyssnar… / Tänker… / Talar…, och mikrofonknappen visar när hon hör dig.

## 3. Mer befogenhet

- Hon utför allt utom radering direkt, utan godkännandekort: kalender, att göra, påminnelser, ekonomi (köp, saldon, fasta utgifter, överföringar, lån), inköp/skafferi, platser och resor, IPTV och juristärenden.
- Kassaskåpet: hon får läsa och spara lösenord/koder direkt utan extra godkännande.
- Radering kräver fortfarande ett ja från dig.
- Varje åtgärd bekräftas med en rad i chatten och en "Ångra"-knapp där det går.

## 4. Proaktiv

- Hon får själv påpeka: obetalda räkningar och fasta utgifter som passerat förfallodag, krockar och för tunna restidsmarginaler i kalendern, ovanligt höga utgifter eller kategorier som sticker ut, IPTV-konton som snart går ut och deadlines i juristärenden.
- Påpekandena visas som korta kort i chatten och i en liten notisrad på startsidan – inga popup-avbrott.

## 5. Alltid nåbar och medveten om var du är

- Andrea-knappen finns i alla vyer och öppnas direkt i röstläge om du håller in den.
- Hon får veta vilken sida du står på och vad som är valt där (t.ex. vilken dag i kalendern, vilket konto under Pengar, vilket besök under Platser) och agerar på "den här", "det där", "dagen" utan att du behöver förklara.
- Hon minns pågående ärende mellan sidbyten.

## 6. Starkare AI

- Djupfilen körs på den starkaste modellen med resonemang, och hon får fler steg per tur så flerstegsuppdrag inte stannar halvvägs.
- Snabbfilen behålls för korta frågor men får hela verktygsuppsättningen så hon aldrig behöver säga "det kan jag inte här".
- Bättre minne: hennes anteckningar om dig plus ett rullande sammandrag av samtalet skickas med, så långa samtal tappar inte tråden.
- Vid osäkerhet gissar hon inte – hon slår upp i appen först.

## Tekniskt

- Ny serverroute `src/routes/api/tts.ts` byggs om mot ElevenLabs (`text-to-speech/{voice}/stream`, `eleven_flash_v2_5`), nyckeln läses i handlern, ljud strömmas som mp3.
- `src/lib/voice.ts` skrivs om: en enda kontinuerlig igenkänning som lever genom hela samtalet, interimresultat för barge-in, stopwordlista, ekoskydd via tidsfönster runt uppspelning, MediaSource-uppspelning av strömmat ljud.
- `src/lib/agent-tools.ts`: `SAFE_TOOLS` utökas till allt utom `delete_*`; `QUICK_TOOL_NAMES` ersätts av hela verktygslistan.
- `src/routes/api/chat.ts`: systeminstruktion får sidkontext, proaktivitetsregler och ångra-krav; `stepCountIs` höjs.
- Ny `src/lib/andrea-context.tsx` (React-context) som håller aktuell vy/markering och skickas med i varje chattanrop.
- Proaktiva signaler räknas fram serverside av befintlig logik (`fixed-expenses.ts`, `spend-flags.ts`, `travel-plan.ts`, IPTV-utgångar) och exponeras via en ny serverfunktion.

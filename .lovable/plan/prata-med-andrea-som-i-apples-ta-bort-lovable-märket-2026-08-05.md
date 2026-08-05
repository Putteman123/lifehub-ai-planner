# Prata med Andrea (som i Apples) + ta bort Lovable-märket

## 1. Röstsamtal med Andrea

Idag finns en enkel mikrofonknapp: den lyssnar en mening i taget, och uppläsningen är avstängd som standard och använder webbläsarens robotröst. I Apples fungerar det som ett riktigt samtal. Det hämtas hit:

- **Kontinuerlig lyssning**: mikrofonen stannar på tills du trycker av. Efter varje mening du säger skickas den direkt till Andrea, och lyssningen startar om automatiskt (även efter tystnad eller små avbrott).
- **Uppläsning på som standard**: Andrea svarar med röst direkt, utan att du behöver slå på något.
- **Riktig röst i stället för robotröst**: hennes svar läses upp med en naturlig svensk AI-röst. Om rösttjänsten inte svarar faller appen tyst tillbaka på webbläsarens uppläsning, så det aldrig blir tyst.
- **Säg "tyst" eller "stopp"**: medan hon pratar lyssnar appen efter stoppord och tystnar direkt — ingen knapptryckning behövs. Knappen "Tysta Andrea" finns kvar.
- **Tydlig status**: mikrofonknappen blir röd med pulserande ring när hon lyssnar, och rubriken växlar mellan "Lyssnar…", "Tänker…" och "Talar…".
- Långa svar kortas innan uppläsning så att hon inte mal på i evighet.

Detta hör till juristappen och tas inte med: diktafon/talarigenkänning, telefonsamtal till klienter.

## 2. "Made with Lovable"

Märket längst ner på den publicerade sidan stängs av. Notera: att dölja det kräver Pro-plan — om kontot inte har det slår inställningen inte igenom, och jag säger till.

## Tekniska detaljer

- `src/lib/voice.ts` byggs ut: `continuous`-igenkänning med auto-restart via `onend`, stopword-lyssnare under uppläsning, `ttsEnabled` default `true`, kö-/avbrottshantering för ljud.
- Ny röstuppläsning via Lovable AI (text-till-tal) i en serverroute `src/routes/api/tts.ts` som returnerar ljud; klienten spelar upp med `Audio`. Ingen ny nyckel behövs, ingen egen Gemini-nyckel som i Apples. Fallback till `speechSynthesis`.
- `src/components/andrea/Andrea.tsx`: mikrofonknappens tillstånd/animation och statusraden uppdateras; inskickning av transkript sker löpande under pågående lyssning.
- Lovable-märket via publiceringsinställningarna (ingen kodändring).

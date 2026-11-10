# Kontoutdrag under Pengar + Perplexity som huvud-AI

## Vad du får
**Ny ruta "Läs in kontoutdrag" under Pengar**
- Ladda upp kontoutdrag från SEB och Revolut (CSV/Excel-export eller PDF).
- Appen känner igen banken automatiskt och läser ut varje rad: datum, belopp, motpart, text.
- Perplexity (med Gemini-modell) sorterar varje rad: utgift (med kategori), inkomst eller överföring.
- **Överföringar mellan dina egna konton** (t.ex. SEB -> Revolut) hamnar under Överföring, inte som utgift + inkomst. Båda sidorna av samma överföring paras ihop så den bara räknas en gång, även om du läser in båda bankernas utdrag.
- **Dubblettkoll**: varje rad jämförs mot det som redan finns (samma datum ±2 dagar, samma belopp, liknande text, inklusive kvitton och tidigare inlästa utdrag). Samma fil två gånger ger inga dubbletter.
- **Automatiskt sparande**: rader som AI:n är säker på är nya sparas direkt. Osäkra rader (möjlig dubblett eller oklar kategori) visas i en kort granskningslista där du trycker Spara eller Hoppa över.
- Efteråt visas en sammanfattning: "42 nya sparade, 8 dubbletter hoppades över, 3 att granska", och vilken AI som svarade.
- Allt körs bara när du trycker på knappen (följer regeln från förra gången).

**Perplexity används så mycket som möjligt**
- Större AI-uppgifter (kontoutdrag, veckoplan, dagssammanfattning, inkorgsskanning, pengacoach, reseinsikter) går till Perplexity först.
- Andrea-chatten svarar via Perplexity i första hand. När Andrea behöver göra något i appen (lägga till händelse, att göra, inköp m.m.) och Perplexity inte klarar det, tar Gemini/Lovable över just det svaret.
- Ordning: Perplexity -> din egen Gemini-nyckel -> Lovable -> ChatGPT. Sidan AI-förbrukning visar den nya ordningen.

## Att känna till
- Bästa resultat får du med CSV/Excel-export från bankerna; PDF fungerar men text läses ut i webbläsaren först.
- Dina egna konton behöver finnas under Pengar (t.ex. "SEB" och "Revolut") så att överföringar kan kopplas rätt; finns de inte frågar appen vilket konto filen gäller.
- Kontoutdragsfilerna sparas inte, bara de inlästa raderna.

## Tekniskt
- Ny tabell `statement_imports` (fil-hash, bank, konto, antal) + kolumner `source`, `import_hash` (unik per användare) på utgifts-/inkomstrader för exakt dubblettskydd; RLS per användare, GRANTs.
- Parsning: SEB/Revolut CSV/XLSX tolkas deterministiskt i webbläsaren (xlsx-paket), PDF via pdfjs till text. Endast normaliserade rader skickas till servern.
- `statement-import.functions.ts` (requireSupabaseAuth): hämtar befintliga rader i datumintervallet, kör deterministisk dubblettmatchning, skickar resten i batchar till Perplexity (json_schema: kind, category, is_internal_transfer, confidence). Confidence >= 0.85 och ingen dubblett -> sparas; annars granskning. Interna överföringar sparas via befintliga transfers-logiken och paras ihop på belopp ±3 dagar.
- `ai-complete.server.ts`: flytta Perplexity först i `completeTextDetailed`; ny `preferPerplexity`-default.
- `api/chat.ts`: Perplexity Responses-API som förstahandsväg för svar utan verktygsanrop; verktygskrävande tur faller tillbaka till befintlig modellkedja. Leverantörsmärkning "Svarade via Perplexity".
- Tester: dubblettmatchning, ihopparning av SEB->Revolut-överföring, tröskel för autosparande, SEB- och Revolut-CSV-tolkning.

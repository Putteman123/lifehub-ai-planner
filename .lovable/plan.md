# Visa vilken AI som svarar i Andrea

## Mål
I Andreas chatt ska varje svar märkas med vilken AI-tjänst som levererade det: din egen Google-nyckel (Gemini), ChatGPT, Perplexity eller Lovable-reserven.

## Ändringar

### 1. AI-kedjan rapporterar vilken tjänst som svarade
- `src/lib/ai-complete.server.ts`: `completeText` och `completeVision` returnerar förutom texten även vilken leverantör som svarade (`google` / `openai` / `perplexity` / `lovable`).
- Samma märkning i reservkedjan i `src/routes/api/chat.ts` och `src/lib/andrea.server.ts` där svaren faktiskt strömmas till chatten.

### 2. Märkning i chatten
- `src/components/andrea/Andrea.tsx`: under varje AI-svar visas en liten, diskret etikett, t.ex.:
  - "Svarade via din Google-nyckel" (grön ton)
  - "Svarade via ChatGPT"
  - "Svarade via Perplexity"
  - "Svarade via Lovable (reserv)" (grå ton)
- Etiketten syns bara på AI-svar, inte på dina egna meddelanden, och stör inte chatten i övrigt.

### 3. Vårddelens Andrea
- `src/lib/care-assistant.functions.ts` får samma märkning så att svaren där också visar vilken tjänst som användes.

## Tekniskt
- Leverantörsnamnet följer med i svarsobjektet från servern; inga nya hemligheter eller databastabeller behövs.
- Verifiering: `bunx tsgo --noEmit` grönt, build OK, samt en testfråga i chatten som visar etiketten.

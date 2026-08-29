# Varför de senaste uppdateringarna inte syns

## Vad kontrollen visar

Alla de senaste stora uppdateringarna finns i projektets kod och bygget är grönt:

- Aurora Glass-designen: mörk natt-blå palett, glaskort, animerad aurora-bakgrund och typsnitten Space Grotesk/DM Sans är inlagda och används av korten på sidorna.
- Smartare kategorier: grupper (Arbete, Familj, Ekonomi, Juridik, Privat), AI-förslag och inlärning finns.
- SMS-modulen: sidan SMS finns i menyn, webhooken för iPhone-genvägarna finns, och Andreas SMS-verktyg är registrerade.

Alltså är inget "ogjort" i koden. Det som skiljer är **var du tittar**: den publicerade sajten (mellberg.online / lifehub-ai-planner.lovable.app) kör fortfarande en äldre version, eftersom appen inte publicerats efter de här ändringarna. Lägger du till att iPhone sparar appen som PWA på hemskärmen kan även en gammal version ligga kvar i cachen.

## Förslag på åtgärd

1. Publicera appen så att de senaste ändringarna når mellberg.online.
2. Verifiera efter publicering att den publicerade sidan laddar de nya typsnitten och att SMS finns i menyn.
3. Om iPhone fortfarande visar den gamla designen: ta bort appen från hemskärmen, öppna i Safari, ladda om, och lägg till den på nytt (PWA-cachen släpper inte alltid av sig själv).
4. Om något enskilt du väntat dig ändå saknas efter publicering – säg vilken funktion, så spårar jag just den.

## Tekniskt

- `src/styles.css` innehåller Aurora-tokens, `card-soft`-glasytor och `aurora-drift`-animationen; `src/routes/__root.tsx` laddar typsnitten.
- `src/lib/categories.ts`, `src/lib/category-learn.ts`, `src/lib/categorize.functions.ts` och `EventDialog.tsx` innehåller kategoriuppdateringen.
- `src/routes/_authenticated/sms.tsx`, `src/routes/api/public/sms.ts`, `src/lib/sms.server.ts`, `src/lib/sms.functions.ts` och navposten i `src/lib/nav-theme.ts` finns på plats.
- Senaste bygglogg: "build OK". Publicerad URL svarar med en äldre version utan de nya typsnitten.

# Stoppa Andreas React-loop

## Bekräftat

- Appen bygger utan fel; problemet uppstår i webbläsaren efter att Andrea hamnat i felstatus.
- React-fel **#185** betyder att komponenten gör för många nästlade uppdateringar.
- I Andrea-panelen skapas både `errorInfo` och röstobjektet på nytt vid varje render. Flera effekter beror på dessa instabila objekt och kan samtidigt anropa `setState`, starta mikrofonen eller köra `regenerate()` igen. Särskilt återförsökseffekten kan återaktiveras medan samma fel och användarmeddelande ligger kvar.

## Åtgärder

1. **Stabilisera fel- och röstberoenden**
   - Memoisera det tolkade felet utifrån själva felmeddelandet.
   - Använd stabila röstfunktioner och primitiva statusvärden i effektberoenden i stället för hela röstobjektet.

2. **Gör återförsök engångssäkert**
   - Ta bort den renderdrivna kedjan som kan köra `regenerate()` flera gånger för samma meddelande.
   - Spärra återförsök med ett ref/id per fel och meddelande samt återställ spärren först när ett nytt försök verkligen startat eller avslutats.
   - Behåll knappen ”Försök igen” och handsfree-kommandot, men låt varje uttrycklig användaråtgärd starta högst ett anrop.

3. **Förhindra state-loopar i fel- och röstläget**
   - Uppdatera röstmeddelande, lyssningsläge och uppläsning endast när värdet faktiskt ändras.
   - Säkerställ att feluppläsning sker en gång per fel och att mikrofonen inte startas om under varje render.

4. **Verifiera scenariot från bilden**
   - Testa flera bilduppladdningar följt av sparade ekonomifiler och ett framkallat AI-fel.
   - Kontrollera att ett enda felkort visas, att panelen förblir användbar och att ett klick på ”Försök igen” endast skickar ett nytt anrop.
   - Kontrollera mobil layout med öppet tangentbord samt senaste runtime-/console- och buildlogg.

## Klart när

- React-fel #185 återkommer inte.
- Andrea visar det ursprungliga AI-felet i klartext i stället för att krascha i en uppdateringsloop.
- Manuellt och röststyrt återförsök kör exakt en gång per kommando.
- Tidigare meddelanden och uppladdade filbekräftelser ligger kvar.

# Fixa: www.livo.health skickas vidare till mellberg.online

## Orsak (bekräftad)
Domänkontrollen visar: `www.livo.health` är **aktiv** och DNS pekar rätt, men den omdirigeras till `mellberg.online` eftersom **mellberg.online är inställd som primär domän**. Alla andra anslutna domäner skickas då dit.

## Åtgärd
1. Du gör en knapptryckning (jag kan inte ändra primär domän åt dig):
   - Öppna **Project Settings → Domains**
   - Öppna mellberg.onlines trepunktsmeny (⋯)
   - Välj **Unset as primary**
2. Därefter serverar varje domän sin egen adress utan omdirigering:
   - `livo.health` och `www.livo.health` → vårdsidan (via host-omskrivningen i `src/server.ts`)
   - `mellberg.online` → din privata app
   - `alfa-demo.livo.health` m.fl. → företagsvyer

## Verifiering
- Kolla `https://www.livo.health` i webbläsaren — ska visa Livo.health-sidan direkt utan att adressen byts.
- Kolla `https://mellberg.online` — ska visa din privata app som vanligt.

## Teknisk detalj
Inga kodändringar behövs — `rewriteHost()` i `src/server.ts` hanterar redan båda domänerna. Det är bara den primära domänens omdirigering på plattformen som ska stängas av.

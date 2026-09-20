# Domänfix + svar: varför inget nytt projekt finns

## Svar på din fråga
Nej — inget nytt Lovable-projekt har skapats. Tidigare planerade vi att flytta vårddelen till ett eget projekt (remix), men den planen avvisades. I stället kopplade vi livo.health till **detta** projekt, där vårdsidan nu körs parallellt med din privata app. Därför finns bara ett projekt.

Vill du ändå ha vården i ett **eget projekt** startar du det själv (det kan bara du göra):
1. Öppna projektets meny → **Remix** (eller skapa ett nytt tomt projekt och @-nämn detta).
2. Säg till mig i det nya projektet, så bygger jag upp vårddelen där och återskapar databasen (vårdtabeller + Alfa Demo).
3. Därefter kopplar vi livo.health till det nya projektet i stället.

## Fixa: www.livo.health skickas vidare till mellberg.online
**Orsak (bekräftad via domänkontroll):** `www.livo.health` är aktiv och DNS pekar rätt, men den omdirigeras eftersom **mellberg.online är primär domän** — alla andra anslutna domäner skickas dit.

**Åtgärd — en knapptryckning du gör själv (jag kan inte ändra primär domän):**
1. Öppna **Project Settings → Domains**
2. Öppna mellberg.onlines trepunktsmeny (⋯)
3. Välj **Unset as primary**

Därefter serverar varje domän sin egen adress utan omdirigering:
- `livo.health` / `www.livo.health` → vårdsidan
- `mellberg.online` → din privata app
- `alfa-demo.livo.health` m.fl. → företagsvyer

## Verifiering
- `https://www.livo.health` visar Livo.health-sidan direkt utan adressbyte
- `https://mellberg.online` visar din privata app som vanligt

## Teknisk detalj
Inga kodändringar behövs — `rewriteHost()` i `src/server.ts` hanterar redan båda domänerna. Det är plattformens primärdomän-omdirigering som ska stängas av.

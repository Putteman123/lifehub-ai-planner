# Riktiga pushnotiser till din telefon

Idag finns inga riktiga pushnotiser. Det som kallas "aviseringar" är lokala notiser som bara visas medan appen är öppen i webbläsaren, och Firebase-biblioteket ligger installerat men används inte av någon del av appen.

Det här bygget ger dig notiser som når din iPhone/dator även när appen är stängd, för dina egna påminnelser i LifeHub (förfallna fasta utgifter, IPTV som går ut, uppgifter med deadline och budgetavvikelser). Vårddelen rörs inte.

## Vad du kommer se

- En ruta "Aviseringar" i LifeHub där du slår på push och ser status: på, avslagen, eller "öppna appen i egen flik".
- En testknapp som skickar en notis till dig direkt så du ser att det fungerar.
- Automatiska notiser en gång per dag för sådant som är brådskande (förfaller idag eller är försenat).
- Notisen öppnar rätt sida i appen när du trycker på den.

## Vad jag behöver av dig

1. Godkänna en Firebase-anslutning i chatten (kort ruta som dyker upp). Där väljer du "Include web push" och klistrar in tre uppgifter från din Firebase-konsol: webb-API-nyckel, app-ID och VAPID-nyckel (Cloud Messaging → Web Push certificates).
2. Notiser måste slås på från appen i en egen flik, inte i förhandsvisningen här inne — webbläsare blockerar frågan i inbäddade fönster. Det hanteras med tydlig text i appen.
3. På iPhone krävs att appen är tillagd på hemskärmen för att push ska fungera; appen visar en instruktion om det behövs.

## Teknisk genomgång

- Firebase Cloud Messaging kopplas via Lovables connector; anrop går genom connector-gatewayen, ingen tjänstenyckel hamnar i koden.
- `public/firebase-messaging-sw.js`: service worker som initieras från query-parametrar och visar notiser i bakgrunden samt öppnar rätt länk vid klick.
- `src/lib/push.ts`: klientlogik som registrerar service workern, hämtar registreringstoken (`getToken` med VAPID) och returnerar tydliga statusvärden (`registered`, `unsupported`, `open-in-new-tab`, `denied`, `not-configured`).
- Migration: tabell `push_tokens` (user_id, token unik, platform, user_agent, created_at, last_seen_at) med RLS (endast egna rader), plus GRANT till `authenticated` och `service_role`.
- `src/lib/push.functions.ts`: serverfunktioner bakom `requireSupabaseAuth` — `savePushToken`, `removePushToken`, `sendTestPush`, och `sendPushToMe(title, body, path)` som POST:ar till `v1/projects/_/messages:send` via gatewayen. Stale token (404 UNREGISTERED / 400) raderas ur tabellen.
- `src/components/dashboard/PushCard.tsx` + koppling i `AlertsCard`: ersätter dagens knapp "Slå på aviseringar" med den nya statusrutan och testknappen.
- Automatiska påminnelser: befintlig `useAlerts` används; brådskande notiser (urgency ≤ 1) skickas via `sendPushToMe` med samma en-gång-per-dag-spärr som idag ligger i `useAlertNotifications`.
- Kvar som fallback: den lokala notisen när push inte är tillgänglig.

## Verifiering

- Typkontroll och bygge utan fel.
- Test av `sendTestPush` mot en registrerad token och kontroll att svaret från Firebase är OK.
- Kontroll att statusrutan visar rätt text i förhandsvisningen (öppna i egen flik) respektive i egen flik.

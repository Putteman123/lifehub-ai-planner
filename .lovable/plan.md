# Testa IPTV-panelen med den nya nyckeln

Målet är att bekräfta att den nya API-nyckeln (32 tecken) accepteras av activationpanel.net, och att fixa det som eventuellt inte stämmer i anropen.

## Steg

1. **Kör hälsokollen** – anropa panelen med `action=packages` och den sparade nyckeln, och läs av det råa svaret (inte bara "ok/fel").
2. **Om nyckeln accepteras:** logga vilka paket-ID:n panelen returnerar och byt ut fritextfältet "Paket-ID" i IPTV-fliken mot en riktig lista att välja från.
3. **Om panelen fortfarande svarar `Invalid API Key`:** visa det exakta svaret och kontrollera om nyckeln ska skickas som annan parameter (t.ex. `key` eller header) enligt panelens Instructions-sida.
4. **Justera svarstolkningen** i `iptv.server.ts` efter panelens verkliga format (fältnamn för m3u-länk, användarnamn, utgångsdatum) så att nya linjer sparas korrekt.
5. **Visa statusen i UI:t** – knappen "Testa panel" ska visa panelens exakta meddelande, inte bara "fel".

## Teknisk detalj

- `checkIptvPanel` i `src/lib/iptv.functions.ts` utökas att returnera panelens råsvar (avkortat) för felsökning.
- `callPanel` i `src/lib/iptv.server.ts` får fallback för nyckelparameterns namn om `api_key` avvisas.
- `IptvPanel.tsx` får paketväljare när paketlistan är känd.

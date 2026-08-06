# IPTV som egen sida med full användarlista

## Vad du får

**1. IPTV flyttas ut ur Jurist**
- Ny egen sida `/iptv` med egen ikon (TV) i både den flytande vänstermenyn och mobilmenyn.
- Jurist-sidan blir ren juridik igen (fliksystemet Juridik/IPTV tas bort).

**2. Användarlista som i panelen**
- Tre nyckeltal överst, samma som i skärmdumpen: **Antal linjer**, **Aktiva/Online**, **Utgångna** – som färgade kort.
- Tabell med kolumnerna: Status (grön "Aktiv" / orange "Utgången"), Användarnamn, Lösenord, Paket, Utgår, **Anteckning** och Åtgärder.
- Anteckningen ligger på samma rad som rätt användare, kopplad via panelens användar-ID/användarnamn – inte via radordning. Anteckningen går att redigera direkt i listan (sparas i appen).
- Sökfält (namn, användarnamn, anteckning), statusfilter (Alla / Aktiva / Utgångna) och sortering på utgångsdatum.
- Kopiera-knappar för användarnamn, lösenord och M3U-länk.
- Mobilvänligt: på telefon visas raderna som kort istället för bred tabell, så inget behöver scrollas i sidled.

**3. Alla användare syns – inte bara de appen skapat**
- Sidan hämtar hela linjelistan från panelen och slår ihop den med appens rader. Konton som skapats direkt i panelen dyker alltså också upp, och de får en lokal post i appen så att du kan sätta kundnamn och anteckning på dem.
- Knappen "Synka från panelen" hämtar om allt (status, utgångsdatum, paket).

**4. Skapa ny M3U-användare**
- Tydlig knapp "Ny M3U-användare" som öppnar ett enkelt formulär: kundnamn, paket (lista från panelen), längd (1/3/6/12 mån + demo) och anteckning.
- Efter skapande visas användarnamn, lösenord och M3U-länk direkt med kopiera-knappar.
- Kvarvarande knappar per rad: Förnya, Uppdatera status, Ta bort ur appen.

**5. Kalenderkoppling för utgångsdatum**
- Varje linje med utgångsdatum får automatiskt en heldagshändelse i LifeHub-kalendern: "IPTV går ut: <kund>", i en egen kategori **IPTV** med egen färg.
- Händelsen flyttas automatiskt när du förnyar eller synkar, och tas bort om linjen tas bort.
- Extra påminnelse 7 dagar innan utgång, så det syns på översikten.

## Teknisk plan

- **Panel-API:** utöka `src/lib/iptv.server.ts` med `fetchLines()` som anropar panelens listnings-action. Panelens exakta action-namn för userlist verifieras först med ett läsanrop mot API:t (kandidater: `userlist`, `lines`, `list`, `get_users`); svaret normaliseras till `{panelId, username, password, status, expiresAt, packageName, notes}`. Om ingen listnings-action finns faller sidan tillbaka på appens rader plus `device_info` per rad, och du får ett tydligt meddelande om det.
- **Migration:** `iptv_lines` får `panel_notes text`, `online boolean`, `last_synced_at timestamptz` samt unikt index på `(user_id, panel_id)` för korrekt upsert vid synk (så att anteckningar och namn följer rätt konto).
- **Serverfunktioner** i `src/lib/iptv.functions.ts`: `syncIptvLines` (hämta panelen → upsert i appen → skapa/uppdatera kalenderhändelser), `updateIptvNote`, `deleteIptvLine`. Alla bakom `requireSupabaseAuth`.
- **Kalender:** händelser skrivs i `events` med `category = "iptv"` och `external_id = "iptv:<line-id>"` så att synk blir idempotent; kategorin läggs till i `event_categories` med egen färgtoken.
- **Frontend:** ny route `src/routes/_authenticated/iptv.tsx` (egen head/SEO), ny komponent `src/components/iptv/IptvUserList.tsx`, `IptvPanel.tsx` bantas till skapa/status. `NAV_ITEMS` i `src/lib/nav-theme.ts` får posten IPTV med Tv-ikon och färgtoken `--nav-iptv` i `src/styles.css`. IPTV-fliken och `IptvPanel`-importen tas bort ur `src/routes/_authenticated/jurist.tsx`.

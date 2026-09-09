# Inbyggd OwnTracks-inställning i LifeHub

Mål: du ska kunna koppla telefonen till Platser med ett tryck i LifeHub — ingen manuell inklistring av adress, nyckel eller lägen i OwnTracks.

## Så blir det för dig

I Platser → Inställningar kommer ett nytt kort: **Anslut telefonen**.

1. **Tryck "Öppna i OwnTracks"** — OwnTracks startar och frågar om den får hämta inställningarna. Du trycker OK. Adress, nyckel, HTTP-läge, Move-läge, avstängd kryptering och avstängd autentisering ställs in automatiskt.
2. **QR-kod** visas som alternativ om du vill koppla från en annan telefon — skanna med OwnTracks kamera-/QR-funktion.
3. **Byt nyckel**-knapp: skapar en ny hemlig nyckel om den gamla läckt. Efter byte trycker du bara på "Öppna i OwnTracks" igen.
4. **Läge**: en liten väljare för Move (tätast) eller Significant (batterisnål) som följer med i inställningsfilen.
5. **Status**: kortet visar direkt om telefonen kommit fram sedan kopplingen, och varnar fortfarande om krypterade meddelanden kommer in.

Den långa adressen finns kvar bakom "Visa adressen" för nödfall, men behövs inte längre i vardagen.

## Teknisk lösning

**Nyckel som appen äger**
- Ny tabell `location_settings` (en rad): `token`, `locator_mode`, `updated_at`. GRANT + RLS enligt projektets standard; endast `authenticated` läser/skriver, `service_role` full.
- Migrationen skapar raden med nuvarande värde från `LOCATION_INGEST_TOKEN_V2` som start så befintlig OwnTracks-konfiguration inte slutar fungera direkt.
- `src/routes/api/public/plats.ts` accepterar token som matchar antingen env-nyckeln (bakåtkompatibelt) eller den aktiva raden i `location_settings`, läst med `supabaseAdmin` inne i handlern. Loggning i `location_ingest_log` oförändrad.

**Konfigurationsleverans**
- Ny publik rutt `src/routes/api/public/otrc.ts`: `GET /api/public/otrc?token=<token>` returnerar OwnTracks-konfig som JSON med `content-type: application/json` och filnamn `lifehub.otrc`. Innehåll: `_type: "configuration"`, `mode: 3` (HTTP), `url` med token, `auth: false`, `encryptionKey: ""`, `monitoring` enligt valt läge, `locatorDisplacement`/`locatorInterval`, `pubExtendedData: true`. Token i query validerar mot `location_settings`, annars 401.
- Klienten bygger länken `owntracks:///config?url=<encodeURIComponent(otrc-url)>` för ett-tryck-import, och samma URL kodas i QR-koden.

**Server functions** (i `src/lib/places.functions.ts`, alla med `requireSupabaseAuth`)
- `getIngestInfo` utökas: returnerar `token`, `ingestUrl`, `otrcUrl`, `owntracksLink`, `locatorMode`.
- `rotateIngestToken`: genererar ny slumpad token (32 byte hex), sparar i `location_settings`, returnerar nya länkar.
- `setLocatorMode`: sparar `move` eller `significant`.

**UI**
- Ny komponent `src/components/platser/OwnTracksSetupCard.tsx` med knapp, QR (rendera via `qrcode`-paketet till en canvas/dataURL), lägesväljare, nyckelbyte med bekräftelsedialog och statusrad från befintlig `ingestDiagnostics`.
- Kortet placeras överst i Platser → Inställningar; `OwnTracksGuide` blir hopfällbar reserv under det.

**Verifiering**
- Typkontroll, tester och build.
- `testIngest` körs mot den aktiva tokenen efter nyckelbyte för att bekräfta att mottagningen svarar.

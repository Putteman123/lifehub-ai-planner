# Platslogg – var jag är och hur länge

Ja, det går. En ny vy **Platser** som loggar var du är, hur länge, och kopplar det till arbetstid och kalendern.

## Svar på din fråga om app som delar plats via API

En webbapp på iPhone kan **inte** spåra i bakgrunden när skärmen är låst. Lösningen är en liten hjälp-app på telefonen som skickar din position till LifeHub:

| Alternativ | Kostnad | Bakgrundsspårning | Krångel |
|---|---|---|---|
| **OwnTracks** (rekommenderas) | Gratis | Ja, kontinuerligt + geofence | Klistra in en URL i appens inställningar, klart |
| **iOS Genvägar** (personlig automation) | Gratis, redan på telefonen | Vid händelse: när du kommer/lämnar en plats, ansluter till bil-Bluetooth, kl 08:00 osv. | 5 min per automation |
| **Traccar / Home Assistant** | Gratis men egen server | Ja | För mycket |

Planen bygger OwnTracks + Genvägar som primär lösning, plus knapp i appen.

## Så här fungerar det

```text
iPhone (OwnTracks / Genvägar)  ──POST──►  LifeHub /api/public/plats
                                              │
Knapp "Jag är här" i appen ───────────────────┤
                                              ▼
                                  matcha mot mina platser
                                  (Jobbet, Tingsrätten, Hemma)
                                              ▼
                            besök: plats + kom kl + gick kl + timmar
                                              ▼
                     Dagsvy · Arbetstid · Kalenderjämförelse · Andrea
```

## Det som byggs

**1. Mina platser**
Namngivna platser med adress/koordinater och radie (t.ex. Jobbet 150 m), färg och typ (jobb, jurist, hem, barn, annat). Du kan sätta plats genom att söka adress eller "använd min position just nu".

**2. Besöksloggen**
Positioner grupperas automatiskt ihop till *besök*: plats, ankomst, avfärd, antal timmar. Korta passager (under 5 min) filtreras bort så loggen inte blir skräpig. Du kan redigera eller radera ett besök manuellt.

**3. Registrering – tre vägar, alla till samma logg**
- Knapp "Jag är här" / "Jag går nu" i appen (alltid pålitlig)
- Automatiskt medan appen är öppen (position var ~2 min)
- OwnTracks/Genvägar i bakgrunden via en privat webhook-URL med hemlig nyckel

**4. Arbetstid automatiskt**
Timmar per dag och vecka per platstyp: jobbtimmar, juristtimmar, hemma. Visas som widgets på Dashboarden bredvid befintlig statistik. Ett besök kan sparas som kalenderhändelse med ett klick.

**5. Reselogg**
Dagsvy med tidslinje: "07:12 Hemma → 07:48 Jobbet (8 h 20 min) → 16:30 Tingsrätten". Med veckosummering och sträcka mellan platser.

**6. Koppling till kalendern**
Vid varje händelse jämförs var du faktiskt var med var du skulle vara: "Juristmöte 18:00 – du var på Jobbet till 18:10". Avvikelser markeras i dagsvyn.

**7. Andrea får platsdata**
Hon kan svara på "Hur många timmar jobbade jag i veckan?", "När kom jag hem i går?", "Hur mycket tid la jag på tingsrätten i maj?" och flagga för långa arbetsdagar.

## Integritet

Platsdata är känslig. Den ligger i din egen databas, låst till ditt konto, och skickas aldrig vidare. Webhooken skyddas av en hemlig nyckel som bara finns i din telefon och på servern. Du kan pausa loggning och radera all historik med en knapp i inställningarna.

## Tekniskt

- Nya tabeller: `places` (namn, lat, lng, radie, typ, färg), `location_pings` (lat, lng, noggrannhet, tidpunkt, källa), `visits` (place_id, arrived_at, left_at, källa, manuellt redigerad). RLS + GRANTs enligt projektets mönster; `visits` indexeras på tid.
- `src/routes/api/public/plats.ts` – webhook för OwnTracks/Genvägar, verifierar en `LOCATION_INGEST_TOKEN`-hemlighet (Zod-validerad payload, stöder OwnTracks `_type: location`).
- `src/lib/geo.ts` – haversine, radie-matchning, gruppering av pings till besök, min-varaktighet 5 min.
- `src/lib/places.functions.ts` – server-fns för platser, besök och dags-/veckosummering.
- `src/routes/_authenticated/platser.tsx` – platshantering, dagens tidslinje, veckostatistik, radera historik.
- Live-läge i webbläsaren via `navigator.geolocation.watchPosition`, endast efter uttryckligt tillstånd, avstängt som standard.
- Andreas kontext i `src/lib/andrea.server.ts` utökas med dagens/veckans besök.
- Adressökning för att skapa platser via Google Maps-connectorn (geokodning på servern).
- Instruktionskort i appen som visar din personliga webhook-URL med kopieringsknapp och steg-för-steg för OwnTracks respektive Genvägar.
- Sidoåtgärd: en hydration-mismatch på `/auth` rättas i samma svep.

## Steg

1. Databas: `places`, `location_pings`, `visits` med RLS
2. Geo-logik och besöksgruppering
3. Webhook + hemlig nyckel
4. Vyn Platser: platser, tidslinje, statistik, integritetskontroller
5. Knapptryck in/ut + live-läge när appen är öppen
6. Dashboard-widgets och kalenderjämförelse
7. Andrea får platskontext
8. Instruktionskort för OwnTracks och Genvägar

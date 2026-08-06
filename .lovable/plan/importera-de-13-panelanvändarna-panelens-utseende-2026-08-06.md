# Importera de 13 panelanvändarna + panelens utseende

## Vad som går att läsa ur skärmdumparna

Båda skärmdumparna visar samma lista i samma ordning (13 rader), så rad 1 i "STATUS/USERNAME/PASSWORD"-vyn hör ihop med rad 1 i "NOTES"-vyn. Det gör att anteckningen kan kopplas till rätt användarnamn.

Läsbart per rad: status (Enabled/Expired), användarnamn och anteckning. Lösenorden är **avklippta i högerkanten** – bara de första ~12 tecknen syns (t.ex. `59c9afbbebea…`). Utgångsdatum och paket syns inte alls.

Raderna som importeras (användarnamn → anteckning, status):
1. 2812637625 → David (Enabled)
2. d524517ddb → Gorans son (Enabled)
3. ff9102bcdb → Goran Milan 1 år (Enabled)
4. 72b1818b64 → Mattias Piva (Enabled)
5. f48fe0a721 → Peter Ribba 1år. (**Expired**)
6. 5414c5c427 → Arnells föräldrar (Enabled)
7. e319d19e22 → Stefan Piva (Enabled)
8. b90d147fdf → Philip piv (Enabled)
9. 33e4f4044b → Per (Enabled)
10. 6caa578f91 → Micke (Enabled)
11. a658894ec2 → Arnells vän (Enabled)
12. 1b2cb685a0 → Arnell (Enabled)
13. d895d0c80f → Iptvx (Enabled)

## Så löser jag lösenorden

1. Först testar jag panelens API med enbart användarnamn (`device_info` utan lösenord, samt varianter som `line_info`/`user_info`). Svarar panelen med fullständig rad hämtas lösenord, paket, utgångsdatum och online-status automatiskt för alla 13.
2. Om panelen kräver lösenord: raderna importeras ändå med användarnamn, status och anteckning, och markeras "Behöver lösenord". Då räcker det att du klistrar in hela lösenordet i en ruta på raden, så synkas resten (paket, utgång, M3U-länk) direkt.

Ingen rad skapas i panelen – detta läser bara in befintliga konton i appen.

## Utseende som i panelen

IPTV-sidan byggs om att följa skärmdumparna:
- Tre nyckeltalskort överst med samma ikoner och färger: orange "LINES Users" (13), grön "LINES Online", röd "LINES Expired".
- Kort med rubrik "Userlist | LINES", filterrad (Visa antal, Status, Anslutningar) och sökfält.
- Tabell med kolumnerna Status, Användarnamn, Lösenord, Paket, Utgår, Anteckning, Åtgärd – gröna "Enabled"- och orange "Expired"-brickor precis som i panelen.
- Mörk panelyta med samma kompakta radhöjd; på iPhone blir raderna kort i stället för sidoscroll.
- "Visar 1 till N av N" och sidnumrering längst ned.

## Teknisk plan

- Migration/seed: de 13 raderna läggs in i `iptv_lines` med `customer_name` = anteckningen, `username`, `status` (aktiv/utgången) och `note`, kopplat till ditt användar-ID.
- `src/lib/iptv.server.ts`: ny `lookupByUsername()` som provar panelens läs-actions utan lösenord och normaliserar svaret.
- `src/lib/iptv.functions.ts`: `setIptvPassword` (fyll i lösenord + direktsynk) och utökad `syncIptvLines` som använder användarnamnsuppslag när lösenord saknas.
- `src/components/iptv/IptvUserList.tsx`: omstylad till panelutseendet (nyckeltalskort, filterrad, tabell/kort, statusbrickor) med lokala paneltokens i `src/styles.css` i stället för hårdkodade färger.
- Kalenderkopplingen (händelse + påminnelse 7 dagar före utgång) körs för varje rad så snart utgångsdatum finns.

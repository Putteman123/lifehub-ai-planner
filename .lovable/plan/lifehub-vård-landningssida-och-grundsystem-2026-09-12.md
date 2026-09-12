# LifeHub Vård – landningssida och grundsystem

Din nuvarande app påverkas inte. Allt nytt läggs som egna sidor på samma projekt (mellberg.online) för alfatest, under namnet LifeHub.

## Om domänen

`lifeguard.se` och `.se`-domäner går inte att köpa via Lovable. Du köper den hos en svensk leverantör (t.ex. Loopia eller One.com) och kopplar in den sedan. Tills dess kör vi på mellberg.online. Eftersom du vill behålla namnet LifeHub föreslår jag `lifehub.se` eller `lifehubvard.se` när det blir dags.

## Del 1 – Landningssida

Ny publik sida på `/vard` med undersidor, byggd i lugn vårdkänsla: djup petrol, varm sand, mycket luft, mjuka kort och diskreta rörelser när man skrollar.

- **Start**: rubrik, kort värdeerbjudande, bild av hemtjänstpersonal i mobilen, tre nyckelvärden (schema, medicin, trygghet).
- **För kommun och region**: upphandlingsvänligt språk, säkerhet, uppföljning.
- **För vårdpersonal**: dagens schema, karta, avprickning.
- **För brukare och anhöriga**: insyn med samtycke.
- **Säkerhet och integritet**: data inom EU, loggning, samtycke, roller.
- **Kontakt**: formulär för intresseanmälan och bokad demo – sparas i systemet och mejlas till dig. Ingen betalning i appen.

Jag tar fram logotyp, ikoner och 4–5 bilder i samma stil, samt mjuka animationer.

## Del 2 – Organisationer och roller

Enkel trappa: **du (superadmin) → organisation → enheter → personer.**

1. Du skapar en organisation (t.ex. "Sundsvalls kommun, hemtjänst Nord") och bockar i vilka moduler den får: Schema, Medicin, Karta, Handla, Ekonomi, Andrea.
2. Organisationens admin bjuder in personal, brukare och anhöriga med e-postinbjudan.
3. Admin kan bara sätta på moduler som du redan gett organisationen – aldrig fler.

Fyra vyer, alla på samma grund:

| Vy | Ser |
|---|---|
| Admin | Schema med adress, uppgifter och beräknad besökstid, personal, brukare, moduler |
| Vårdpersonal | Dagens schema, uppgiftslista att pricka av, karta och bästa väg, medicin |
| Brukare | Dagens schema, besök från vård och anhöriga, medicintider, Andrea |
| Anhörig | Medicin taget, genomförda besök, schema, handlat – och ekonomi endast med samtycke |

Admin och personal ser aldrig ekonomi. Anhörig ser bara det brukaren gett samtycke till, och samtycket kan tas tillbaka när som helst.

## Del 3 – Vad som byggs nu

I detta steg: landningssidan, organisationer, moduler, roller, inbjudningar och en inloggad startvy per roll som visar rätt flikar. Schemaläggning, avprickning, medicinlista, karta och Andrea kopplas på i nästa steg, ovanpå det som redan finns i appen.

## AI som gör det enkelt

- Admin kan skriva eller klistra in ett schema i fritext – AI tolkar och föreslår besök med adress, uppgifter och tid.
- AI föreslår besöksordning utifrån färdsätt och restid.
- Andrea får en trygg brukarvariant med begränsade befogenheter.

## Senare

Medicinpåminnelser, Icas näthandel, avvikelserapport, statistik för uppföljning, betalning och abonnemang.

## Tekniskt

- Nya tabeller: `organizations`, `org_members` (roll per person och organisation), `org_modules`, `org_invites`, `care_clients`, `care_consents`, `sales_leads`. Alla med RLS där åtkomst går via organisationstillhörighet, plus `GRANT` enligt projektets standard.
- Roller (`superadmin`, `org_admin`, `caregiver`, `client`, `relative`) lagras i egen tabell och kontrolleras med en SECURITY DEFINER-funktion, aldrig från klienten.
- Nya routes: publika `/vard`, `/vard/kommun`, `/vard/personal`, `/vard/brukare`, `/vard/sakerhet`, `/vard/kontakt` med egen SEO-metadata, och skyddade `/v/*` för den inloggade delen med egen layout och rollbaserad meny.
- Befintliga routes, meny och data rörs inte; den nya delen har eget skal.
- Bilder genereras och läggs i `src/assets`, animationer med befintliga Tailwind-verktyg.
- Demo- och pilotdata: påhittade brukare, men behörighet och läsloggning byggs korrekt från start.

# Kundregister och behörighetsmatris för LifeHub Vård

Din befintliga app och all din data ligger kvar orörd. Det här är en ny del som bara du som superadmin kommer åt.

## Ditt konto

Kontot patrick@mellberg.online är redan registrerat som systemägare (superadmin) i databasen sedan 18 augusti. Ingen ändring behövs – det kontot används för hela bygget. Inga kunder finns upplagda ännu.

## Del 1 – Lägga upp en ny kund

Ett nytt formulär i tre steg under Organisationer:

**Steg 1 – Företagsuppgifter**
Företagsnamn, organisationsnummer, bransch/segment (kommun, privat hemtjänst, boende), besöksadress, webbplats.

**Steg 2 – Kontakt och avtal**
Kontaktperson (namn, roll, e-post, telefon), fakturaadress, fakturamejl, referens/märkning, avtalsstart, avtalsform (pilot, avtal), status (prospekt, aktiv, pausad), antal platser/licenser, interna anteckningar.

**Steg 3 – Behörigheter** (nedan)

När kunden sparas kan du direkt bjuda in kundens första verksamhetsadmin.

## Del 2 – Behörighetsmatris

En kryssrutematris som sätts per kund, med fyra roller i kolumner:

| Roll | Betyder |
|---|---|
| Vårdföretag (admin) | Kundens administratör |
| Personal | Vårdpersonal ute i tjänst |
| Brukare | Den som får vård |
| Anhörig | Närstående, alltid med samtycke |

Rader är modulerna: Schema, Uppgifter, Medicin, Karta och rutt, Handla, Ekonomi, Andrea (AI), Personuppgifter, Avvikelser, Rapporter.

Varje ruta i matrisen har två nivåer: **Se** och **Ändra**. Kryssar du bort Se försvinner modulen helt för den rollen – inga knappar, inga flikar, inget data.

Inbyggda spärrar för integritet som inte går att klicka bort:
- Personal och vårdföretagets admin kan aldrig se brukarens ekonomi.
- Anhörig ser bara det brukaren gett samtycke till, och samtycket kan tas tillbaka när som helst.
- Brukaren ser alltid sina egna uppgifter.

Tre färdiga mallar att starta från (Standard hemtjänst, Minimal, Full insyn) så du slipper klicka igenom allt för varje ny kund. Matrisen kan ändras när som helst i efterhand på kundens sida.

## Del 3 – Kundöversikt

Listan över kunder visar namn, status, antal personal, brukare och anhöriga, samt vilka moduler som är påslagna. Klick på en kund öppnar företagsuppgifter, behörighetsmatris, personer och brukare på samma sida.

## Senare

Egen domän för den nya affärsmodellen tar vi i ett separat steg när du valt domännamn.

## Tekniskt

- Ny tabell `care_customers` (eller utökning av `organizations`) med affärsfälten ovan; `org_permissions` med rad per organisation/roll/modul och kolumnerna `can_view`/`can_edit`, unik nyckel per kombination. RLS: läsning och skrivning endast för systemägare eller organisationens admin via befintliga `is_app_owner` / `can_manage_org`, plus GRANT enligt projektstandard.
- Hårda integritetsregler valideras i databasen (trigger) och i serverfunktionen – inte bara i gränssnittet.
- `src/lib/care.ts` utökas med modul-/rollmatris och mallar; `visibleModules` ersätts av en behörighetsuppslagning som kombinerar organisationens moduler med matrisen.
- Nya serverfunktioner i `src/lib/care.functions.ts`: `createCustomer`, `updateCustomer`, `getOrgPermissions`, `setOrgPermissions`, samtliga med `requireSupabaseAuth` och ägarkontroll.
- Gränssnitt: `/v/organisationer` delas upp i lista + detaljsida `/v/kund/$orgId` med flikarna Uppgifter, Behörigheter, Personer, Brukare.
- Befintliga privata routes, meny och data rörs inte.

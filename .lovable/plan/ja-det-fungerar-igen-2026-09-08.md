# Ja – det fungerar igen

## Vad mätningen visar

- Telefonen skickar in positioner just nu: senaste sparade läget kom 18:52 (svensk tid), och flera positioner har registrerats de senaste minuterna med källa "telefon".
- Men majoriteten av anropen från telefonen kommer in som **krypterade meddelanden** som appen inte kan läsa. De loggas som "annat meddelande" och kastas bort. Det betyder att bara en del av dina positioner sparas.

## Åtgärd på telefonen (ingen kodändring)

1. OwnTracks → Inställningar → töm fältet **Hemlig krypteringsnyckel** helt.
2. Kontrollera att hela LifeHub-adressen ligger i **URL-fältet** för HTTP-läget (kopiera från LifeHub → Platser vid osäkerhet).
3. Sätt **Locator/Positionsrapportering = Move** för tätare uppdateringar.
4. Skicka en position manuellt från kartan.
5. Kontrollera i LifeHub → Platser att den syns direkt.

## Ändring i appen

- Platser-sidan får en tydlig varning när krypterade meddelanden tas emot: "Telefonen skickar krypterat – töm Hemlig krypteringsnyckel i OwnTracks", i stället för att de bara försvinner tyst.
- Teknisk del: `src/components/platser/ConnectionCheckCard.tsx` och diagnostiken i `src/lib/places.functions.ts` får ett eget utfall för `annan_typ` med `_type=encrypted`. Ingen ändring i mottagningen eller databasen.

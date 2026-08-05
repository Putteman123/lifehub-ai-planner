# Olika färger för natt- och kvällspass i kalendern

Idag färgas alla arbetspass likadant (kategorifärgen "Heltidsjobb", indigo). Passen ska istället få egen färg beroende på när de ligger på dygnet.

## Så här definieras passen

- **Nattpass** — börjar 21:00 eller senare och slutar nästa morgon (t.ex. 21:30–07:15). Färg: djup natt-blå/violett.
- **Kvällspass** — börjar 13:00–20:59 och slutar samma dygn (t.ex. 14:00–22:00). Färg: varm bärnstensorange.
- **Dagpass** — allt annat behåller nuvarande jobbfärg.

Färgningen gäller bara händelser i kategorin Jobb, och sker automatiskt utifrån tiderna — inget behöver fyllas i manuellt.

## Var det syns

- Dag-, vecka-, månad- och agendavyn: chip/kantfärg följer passtypen.
- Dagvyn och agendan visar även en liten etikett "Natt" / "Kväll" bredvid tiden.
- Kategorifiltret behåller en enda "Heltidsjobb"-knapp som fortsatt täcker alla tre passtyper.

## Teknisk del

- `src/styles.css`: två nya tokens `--cat-natt` och `--cat-kvall` (ljus + mörk temavariant) mappade i `@theme inline` till `--color-cat-natt` / `--color-cat-kvall`.
- `src/lib/categories.ts`: ny hjälpare `shiftMeta(event)` som returnerar `dot`/`chip`/`bar`/`label` — faller tillbaka på `categoryMeta(event.category)` när det inte är ett jobb-pass.
- `src/lib/calendar.ts`: ny ren funktion `shiftType(event): "natt" | "kvall" | null` som klassificerar utifrån start-/sluttid.
- `src/routes/_authenticated/kalender.tsx`: `EventChip`, `DayView` och `AgendaView` använder `shiftMeta` istället för `categoryMeta`.

Rent presentationslager — inga databas- eller logikändringar.

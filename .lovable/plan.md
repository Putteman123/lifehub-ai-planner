# LifeHub 6.0 – nytt utseende rakt igenom

Appen byter från dagens mörka nattblå till ett ljust, lugnt uttryck: varmt papper, djupblått bläck och en varm röd accent. Samma innehåll och funktioner — men tydligare, luftigare och lättare att läsa i dagsljus.

## Färg och känsla

- **Bakgrund:** varmt papper (#F6F3EC), kort i rent vitt med mjuk skugga i stället för glaseffekter.
- **Text och rubriker:** djupblått bläck (#1B2A5B).
- **Accent:** varm röd (#D2543F) för det som är viktigt — varningar, förfallna räkningar, aktiva val.
- **Kategorifärgerna** (jobb, barn, jurist, pengar, IPTV med flera) görs om till en dämpad palett som fungerar mot ljus bakgrund, med samma betydelse som i dag.
- **Mörkt läge** följer med: samma palett vänd till kväll, så appen inte bländar på natten.

## Typografi

Rubriker i **Outfit**, brödtext i **Figtree** — rundare och tydligare på telefon. Siffror (belopp, tider, avstånd) får fast bredd så kolumner ligger i linje.

## Layout: kontrollpanel

- **Översikt** börjar med en rad nyckeltal högst upp: saldo kvar i månaden, dagens händelser, uppgifter kvar, senaste position. Under det ligger dagens innehåll i tätare kort.
- **Pengar, Platser, Handla, Kalender** får samma uppbyggnad: nyckeltal överst, innehåll under, samma kortmall överallt.
- Kort blir stramare: tydlig rubrikrad med ikon i kategorifärg, mindre inramning, mer luft mellan innehållet.
- Flytande menyn och flikarna behåller sin funktion men får det nya utseendet och tydligare markering av vald sida.

## Vad som inte ändras

Ingen funktion tas bort, inga data påverkas, ingen databasändring. Bara utseendet.

## Tekniska detaljer

- `src/styles.css`: nya oklch-tokens för `:root` och `.dark` (background, foreground, card, primary = bläckblått, accent = tegelrött, border, muted), omgjorda `--cat-*` och `--nav-*`, `--radius` sänks till ca 1rem, nya skuggtokens (`--shadow-card`, `--shadow-raised`) som ersätter aurora-gradienterna.
- Fonter laddas via `<link>` i `src/routes/__root.tsx` (Outfit + Figtree från Google Fonts) och sätts som `--font-display` / `--font-sans` i `@theme`. Inga URL-importer i CSS.
- `SectionCard.tsx` får en stramare variant plus en ny `StatTile`-komponent för nyckeltalsraden; `AppShell.tsx` och `FloatingNav.tsx` uppdateras mot de nya tokens.
- Genomgång av komponenter under `src/components/**` och rutter under `src/routes/_authenticated/**` för hårdkodade färgklasser (t.ex. `text-white`, `bg-black`, glass-/aurora-klasser) som byts mot semantiska tokens.
- Sidorna `dashboard.tsx`, `pengar.tsx`, `platser.tsx`, `handla.tsx`, `kalender.tsx` får nyckeltalsraden överst.
- Verifiering: typkontroll, befintliga tester och en skärmbildskontroll av Översikt, Pengar och Platser i iPhone-bredd.

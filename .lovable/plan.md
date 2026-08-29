# LifeHub 4.0 – Aurora Glass, smartare kategorier och AI-magi

En ordentlig ansiktslyftning av hela appen: nytt mörkt glasgränssnitt, upprensad struktur, kategorier som faktiskt är användbara, och AI som gör vardagen magisk.

## 1. Nytt utseende – "Aurora Glass"

- **Färg**: mörk bas (djup natt-blå #1a1a2e / #16213e) med två levande accenter – mint #4ade80 och lila #a78bfa. Aurora-gradienter i bakgrunden som rör sig långsamt bakom innehållet.
- **Glasytor**: kort får halvtransparent bakgrund, mjuk kant, blur och inre ljusrand i stället för dagens platta vita kort. Ljust läge behålls som en dämpad variant av samma palett.
- **Typografi**: Space Grotesk för rubriker, DM Sans för brödtext (laddas via `<link>` i root-routen).
- **Luft och rytm**: större radie (20–24 px), tydligare hierarki, 44 px tryckytor, konsekventa avstånd på alla sidor.
- **Rörelse**: mjuka in-animationer på kort, glöd vid hovring/tryck, aurora-puls när Andrea tänker.
- **Flytande meny** får samma glaskänsla, aktiv vy markeras med aurora-glöd i lägets färg.

## 2. Startsida som bento-rutnät

```text
+-----------------------------------------------+
| Andreas briefing (bred, aurora-gradient)      |
+---------------------------+-------------------+
| Dagens kalender (stort)   | Pengar/dagsbudget |
+-------------+-------------+-------------------+
| Att göra    | Handla      | Platser idag      |
+-------------+-------------+-------------------+
```

- **Adaptiv**: korten ordnas om automatiskt efter vad som är relevant just nu (t.ex. inköpslista högt upp på handledag, pass/avresetid på arbetsdag, obetalda fakturor nära förfallodatum). Ordningen förklaras med en liten rad "Visas för att …".
- På iPhone: en kolumn, allt över vikten utan sidoscroll.

## 3. Smartare kategorier

Kategorierna är idag en platt lista som vuxit ihop med utgiftskategorier, navfärger och pass-typer. De byggs om till ett gemensamt system:

- **En kategorimodell** som delas av kalender, utgifter, uppgifter och skafferi – ikon, färg, grupp (Arbete, Familj, Ekonomi, Juridik, Privat) och regler.
- **Grupper med underkategorier** i stället för en lång lista; väljaren visar de senast/mest använda först.
- **AI-autokategorisering**: nya händelser, köp, kvittorader och uppgifter får förslag på kategori direkt, med ett litet "Andrea föreslog"-märke som går att ändra med ett tryck. Rättelser sparas som regler så att det blir rätt nästa gång.
- **Städning**: dubbletter och överlappande kategorier slås ihop (t.ex. tobak/snus, jurist/utlägg juridik) med en engångsgenomgång där du godkänner sammanslagningarna.
- **Insikter**: varje kategori får en egen vy med trend, senaste poster och månadsbelopp – samma sida oavsett om du klickar den i kalendern eller i tårtdiagrammet.

## 4. AI-magi

- **Daglig briefing**: överst på startsidan skriver Andrea en kort text om dagen – vad som händer, vad som kräver åtgärd, ledig tid, pengaläget – med snabbknappar.
- **Kommandopalett (⌘K / tryck på sökikonen)**: skriv eller säg fritt ("boka tandläkare på torsdag 14", "hur mycket har jag kvar i veckan?") och Andrea utför eller navigerar direkt. Ersätter behovet av att leta i menyn.
- **Auto-kategorisering** enligt ovan, med löpande inlärning i Andreas minne.
- **Adaptiv startsida** styrd av samma signaler.

## 5. Genomgång och uppstädning av hela appen

Varje sida (Översikt, Kalender, Att göra, Handla, Pengar, Barn, Jurist, IPTV, Platser, Kassaskåp, Kalendrar) gås igenom och får: samma korthuvud, samma tomtillstånd, samma laddningsskelett, konsekventa knappar och rubriker, ingen sidoscroll på iPhone 16 Pro. Funktioner som byggts in i fel sida flyttas till rätt plats.

## Tekniskt

- `src/styles.css`: nya tokens (aurora-bakgrund, glasytor, skuggor, radie), kategori- och navfärger flyttas till en gemensam skala. Inga hårdkodade färger i komponenter.
- Ny/omgjord `SectionCard` + `GlassCard`, `BentoGrid`, `Briefing`, `CommandPalette` som delade komponenter.
- Kategorimodellen samlas i `src/lib/categories.ts` (grupper, ikoner, alias) plus en migration som lägger till `group`/`icon` på `event_categories` och en mappningstabell för AI-inlärda regler, med GRANT + RLS.
- Autokategorisering via befintlig AI-väg (`ai-complete.server.ts` med Gemini och Lovable AI som reserv) – inga nya tjänster.
- Kommandopaletten återanvänder Andreas agentverktyg (`agent-tools.ts`), ingen ny backend-logik.
- Verifieras med rendering i 402×874 för varje vy innan jag är klar.

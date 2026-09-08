# Varför Platser slutat uppdatera

## Vad mätningen visar

- Senaste riktiga positionen från telefonen kom **7 september kl. 15:28** (svensk tid). Inget efter det.
- Efter den tidpunkten finns bara träffar från appens egen testknapp ("rätt adress och nyckel") — alltså: adressen och nyckeln är korrekta, men telefonen skickar inga positioner.
- Den 6 september finns några "fel nyckel"-försök, men de slutade när adressen rättades. Det är inte orsaken nu.

Slutsats: problemet ligger i OwnTracks-appens rapportering, inte i LifeHub. Det stämmer med din statusbild där **Status står på "inaktiv"**.

## Vad som ska kontrolleras på telefonen

1. **Platsbehörighet**: iOS-inställningar → OwnTracks → Plats ska vara **Alltid** och **Exakt plats** påslaget. Byter iOS tillbaka till "När appen används" slutar bakgrundsrapporteringen tyst — vanligaste orsaken till att det funkar länge och sedan slutar.
2. **Rapporteringsläge**: OwnTracks → Inställningar → Locator/Positionsrapportering → välj **Move** (eller Significant). Står den på Manual skickas ingenting.
3. **Bakgrundsuppdatering**: iOS-inställningar → OwnTracks → Bakgrundsuppdatering på, och Lågeffektläge av (lågeffektläge stoppar bakgrundspositioner).
4. **Host/adress**: den långa LifeHub-adressen ska ligga i adressfältet för HTTP-läget, och fältet "Hemlig krypteringsnyckel" ska vara tomt.
5. Skicka en position manuellt från kartan och kontrollera i LifeHub → Platser → Inställningar att den registreras som mottagen från telefonen.

## Ändring i appen

Platser-sidan får en tydligare varning: om ingen riktig telefonposition kommit på över 6 timmar visas en röd ruta med texten "Telefonen har inte skickat någon position sedan <tid>" plus checklistan ovan, i stället för att sidan bara ser tom ut. Testträffar räknas inte som riktig position.

## Teknisk del

- Ingen databasändring och ingen ändring av mottagningen i `src/routes/api/public/plats.ts` — den fungerar (verifierat i loggen).
- `src/components/platser/PlacesStatusCard.tsx`: lägg till tystnadslarm baserat på senaste ping med `source = 'telefon'` och en kort åtgärdslista.

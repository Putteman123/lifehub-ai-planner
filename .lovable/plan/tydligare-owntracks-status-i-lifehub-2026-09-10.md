# Tydligare OwnTracks-status i LifeHub

## Mål
Behåll OwnTracks och låt LifeHub visa den verkliga anslutningsstatusen, så att OwnTracks egen missvisande text ”inaktiv” inte skapar osäkerhet.

## Ändringar
- Visa **”OwnTracks fungerar”** när en riktig telefonposition nyligen har sparats.
- Visa exakt tid för senaste position, hur länge sedan den kom och antal mottagna positioner senaste dygnet.
- Förklara kort att `monitoring 1` och `locatorInterval 180` betyder automatisk rapportering ungefär var tredje minut.
- Ändra guiden som nu säger att ”Status inaktiv” betyder att inget skickas; den ska i stället hänvisa till LifeHubs egen mottagningsstatus.
- Behåll varningen först när inga riktiga telefonpositioner kommit på sex timmar.
- Uppdatera anslutningskontrollen automatiskt oftare så att en ny position syns snabbt.

## Verifiering
- Kontrollera mot verkliga mottagna positioner från telefonen.
- Kontrollera att både aktivt läge och sex timmars tystnad ger rätt besked.
- Kontrollera sidan på iPhone-storlek och säkerställ att text och status ryms utan överlappning.

## Bekräftat nuläge
LifeHub tog emot godkända OwnTracks-positioner var tredje minut den 9 september 2026, senast 23:36 svensk tid. Felet i statusbilden hindrar alltså inte den aktuella överföringen.

# Gör verksamhetsadmin användbar

## Mål
Bygg de saknade sidorna så att en verksamhetsadmin kan öppna sitt företag via `/v/f/<kortnamn>` och sköta personal, brukare, schema och insatsmallar. Befintlig LifeHub-data och superadminens kundregister lämnas orörda.

## Det som byggs
- En gemensam företagsvy med företagets namn, dagens nyckeltal och navigation som endast visar aktiverade moduler.
- Startvy med sökbara listor för personal och brukare samt formulär för att lägga till och ändra båda.
- Brukarsida med kontaktuppgifter, anhöriga och medicinlista.
- Veckoschema med besök, ansvarig personal, tider och varning för obemannade eller överlappande besök.
- Sida för insatsmallar som kan skapas, ändras och tas bort.
- Länkar från vårdöversikten och kundregistret till respektive företags adminvy.
- Automatisk omskrivning från `<kortnamn>.mellberg.online` till företagets adminvy, medan `/v/f/<kortnamn>` fortsätter fungera i förhandsvisningen.

## Säkerhet och åtkomst
- Alla sidor ligger bakom befintlig inloggning och PIN/Face ID-låsning.
- Varje hämtning och ändring kontrollerar att användaren är superadmin eller administratör för rätt företag.
- Företagets valda moduler styr vilka delar som visas och går att öppna.

## Tekniska detaljer
- Lägg till TanStack-routes under `_authenticated/v/f.$slug` för översikt, brukardetalj, schema och insatser.
- Återanvänd serverfunktionerna i `care-admin.functions.ts` och komplettera endast där ett nödvändigt flöde saknas.
- Uppdatera kundskapandet så att ett unikt kortnamn sparas automatiskt.
- Lägg värdnamnsomsrivningen i serveringången utan att påverka huvuddomänen eller befintliga API-adresser.
- Kontrollera sidornas metadata, mobil/desktop, tomma lägen, felmeddelanden och den aktuella byggstatusen.

# Google-tjänster i LifeHub AI

Eftersom appen bara används av dig (PIN/Face ID, inga användarkonton) kopplas Google på som dina egna konton – du loggar in en gång via Google, och Andrea plus alla vyer får åtkomst direkt.

## Ny sektion: "Google-konton" på sidan Kalendrar

Överst på Kalendrar-sidan, ovanför kalenderkorten, läggs ett rutnät med Google-tjänster:

```text
Google-konton
[ Kalender  ✓ ansluten ]  [ Gmail  Anslut ]  [ Drive  Anslut ]
[ Sheets    Anslut     ]  [ Docs   Anslut ]  [ Maps   Anslut ]
```

Varje kort visar tjänstens ikon, status (ansluten / ej ansluten) och en knapp som startar Google-inloggningen. Inloggningen sker via Lovables säkra Google-flöde – inga lösenord hanteras i appen.

## Tjänster som kopplas på

| Tjänst | Vad du får i appen |
| --- | --- |
| Google Calendar | Hämtar dina riktiga Google-kalendrar direkt (ingen ICS-länk behövs), tvåvägs: händelser du skapar i LifeHub kan skrivas till Google |
| Gmail | "Inkorg"-kort på Dashboard med olästa mejl, Andrea kan söka, sammanfatta och skicka mejl |
| Google Drive | Bifoga dokument till kalenderhändelser och juristärenden direkt från Drive |
| Google Docs | Andrea kan skapa/läsa anteckningar och mötesprotokoll under Jurist |
| Google Sheets | Export av statistik (arbetade timmar, juristtimmar, resor) till kalkylark |
| Google Maps | Riktig restid och rutter i Platser/reseplanen istället för uppskattning |

## Integrationer i befintliga vyer

- **Kalendrar**: Google-kalendrar listas som vanliga källor med synk-knapp; synk hämtar via Google Calendar API istället för ICS.
- **Kalender/Dashboard**: händelser från Google visas färgkodade som allt annat, dubbletter slås ihop som idag.
- **Jurist**: knapp "Bifoga från Drive" och "Skapa anteckning i Docs" på ärenden.
- **Dashboard**: nytt Gmail-kort med olästa/viktiga mejl.
- **Platser**: restidsberäkning använder Google Maps när det är kopplat.
- **Andrea**: nya verktyg – `google_calendar_write`, `gmail_search`, `gmail_send`, `drive_search`, `maps_route` – så du kan säga "läs mina olästa mejl" eller "boka mötet i min Google-kalender".

## Tekniskt

- Kopplingarna görs som Lovable App-connectors (connector_id: `google_calendar`, `google_mail`, `google_drive`, `google_docs`, `google_sheets`, `google_maps`). Varje koppling godkänns av dig i en dialog i chatten.
- All API-trafik går genom Lovables connector-gateway från serverfunktioner (`src/lib/google/*.server.ts`) – aldrig från webbläsaren, så nycklar exponeras inte.
- Nya serverfunktioner: `src/lib/google.functions.ts` (status per tjänst, kalenderlista, kalendersynk, Gmail-lista/sök/skicka, Drive-sök, Maps-restid).
- Google Calendar-synk återanvänder befintlig `events`-tabell och `mergeDuplicates`; `calendars.source = "google"` får extern kalender-id sparat i en ny kolumn `external_id`.
- Andrea-verktygen registreras i `src/lib/agent.server.ts` och `src/routes/api/chat.ts`.
- Kort som inte är kopplade visas som "Anslut" och gör inga API-anrop förrän kopplingen finns.

## Ordning

1. Koppla tjänsterna (dialog per tjänst i chatten).
2. Serverfunktioner + statusendpoint.
3. Google-sektion på Kalendrar-sidan.
4. Kalendersynk via Google API.
5. Gmail-kort på Dashboard, Drive/Docs i Jurist, Maps i Platser.
6. Andrea-verktyg.

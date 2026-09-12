# LifeHub AI

Din personliga AI-assistent för arbete, familj och privatliv. Byggd med [Lovable](https://lovable.dev).

## 1. Koppla till GitHub

För att backa upp all kod och kunna återställa projektet själv:

1. Öppna appen i [Lovable-redigeraren](https://lovable.dev).
2. Klicka på **Plus (+)-menyn** längst ner till vänster i chatten.
3. Välj **GitHub → Connect project**.
4. Logga in på GitHub och godkänn Lovable-appen.
5. Välj vilket konto eller organisation repot ska ligga i.
6. Klicka på **Create Repository**.

Efter det synkas varje ändring i Lovable automatiskt till GitHub. Du kan också klona repot lokalt eller ladda ner det som ZIP.

## 2. Kör appen lokalt

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Appen startar på `http://localhost:8080`.

## 3. Koppla OwnTracks (platsspårning)

LifeHub tar emot positioner från OwnTracks på telefonen.

### Så här kommer du igång

1. Installera **OwnTracks** från App Store.
2. Öppna LifeHub i webbläsaren och gå till **Platser → Inställningar**.
3. Tryck på **"Anslut telefonen"** och sedan **"Öppna i OwnTracks"**.
4. Om OwnTracks frågar om att hämta inställningarna, tryck **OK**.

### Om ett-trycksknappen inte fungerar

1. I OwnTracks: gå till **Inställningar → Läge/Mode** och välj **HTTP**.
2. Gå till **Inställningar → Avancerat** (eller expertinställningar).
3. Hitta fältet **URL** längst ned och klistra in hela LifeHub-adressen exakt en gång.
4. Töm fältet **Hemlig krypteringsnyckel** helt.
5. Stäng av **Websockets**.
6. Slå på **TLS**.
7. Lämna **Autentisering** och **Lösenord** av.
8. Ställ in **Locator/Positionsrapportering** på antingen **Significant** (batterisnålt) eller **Move** (tätast).
9. Gå tillbaka till kartan i OwnTracks och tryck på skicka-ikonen uppe till höger för att skicka en testposition.
10. Kontrollera i LifeHub → Platser → Inställningar att positionen kommit fram.

### Viktiga iPhone-inställningar

- Inställningar → OwnTracks → Plats: **Alltid**, **Exakt plats** på och **Bakgrundsuppdatering** på.
- Låg effektläge och fokusläge kan pausa rapporteringen.

## 4. Google Maps-nyckel för egen domän

LifeHub använder Google Maps för kartor och avstånd. Den Lovable-hanterade nyckeln fungerar bara på `*.lovable.app`. Om du använder en egen domän, till exempel `mellberg.online`, behöver du en egen API-nyckel.

### Så här skapar du nyckeln

1. Gå till [Google Cloud Console](https://console.cloud.google.com/).
2. Välj eller skapa ett projekt med **fakturering aktiverad**.
3. Aktivera dessa API:er:
   - **Maps JavaScript API**
   - **Places API (New)**
   - **Geocoding API**
   - **Routes API**
4. Gå till **API:er och tjänster → Autentiseringsuppgifter**.
5. Klicka på **Skapa autentiseringsuppgifter → API-nyckel**.
6. Begränsa nyckeln till **HTTP-referrers** och lägg till exakt dessa rader:
   - `https://mellberg.online/*`
   - `https://www.mellberg.online/*`
7. Kopiera nyckeln.

### Koppla nyckeln till LifeHub

1. Gå tillbaka till [Lovable-redigeraren](https://lovable.dev).
2. Öppna **Inställningar → Connectors**.
3. Välj **Google Maps Platform**.
4. Klicka på **New connection** och sedan **Use your own credentials**.
5. Klistra in din API-nyckel och spara.

Den nya nyckeln används automatiskt för kartor och avstånd i hela appen.

## 5. Teknikstack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Supabase (Lovable Cloud)

## Egen Google Maps-nyckel

LifeHub använder din egen Google-nyckel för karta, rutter, avstånd, gatubilder och platssök.
Nyckeln sparas som hemligheten `GOOGLE_MAPS_OWN_KEY` i projektets inställningar.

Aktivera dessa API:er i Google Cloud:

- Maps JavaScript API
- Places API (New)
- Geocoding API
- Routes API
- Street View Static API
- Maps Static API

Begränsa nyckeln till webbadresserna:

- `https://mellberg.online/*`
- `https://www.mellberg.online/*`
- `https://*.lovable.app/*`

Saknas nyckeln faller appen tillbaka till Lovables delade kartnyckel, som bara fungerar på lovable.app-adressen.

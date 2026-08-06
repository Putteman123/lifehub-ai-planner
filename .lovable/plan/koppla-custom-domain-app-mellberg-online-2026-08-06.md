# Koppla custom domain app.mellberg.online

## Mål
Publicera LifeHub AI under `app.mellberg.online` istället för (eller bredvid) den nuvarande `lifehub-ai-planner.lovable.app`.

## Nuvarande läge
- Appen är redan publicerad och synlig publikt på `https://lifehub-ai-planner.lovable.app`.
- Ingen custom domain är konfigurerad för projektet än.

## Steg

1. **Öppna domäninställningarna**
   - Gå till **Project Settings → Project section → Domains** i Lovable.
   - Alternativt klicka på **Publish**-knappen och välj **Add custom domain**.

2. **Lägg till subdomänen**
   - Klicka **Connect Domain**.
   - Ange `app.mellberg.online` (inte bara `mellberg.online`).

3. **Konfigurera DNS hos din domänleverantör**
   Lovable kommer att be dig lägga till följande poster för `app.mellberg.online`:
   - **A-record**
     - Name: `app`
     - Value: `185.158.133.1`
   - **TXT-record**
     - Name: `_lovable.app`
     - Value: `lovable_verify=...` (exakt värde visas i Lovable)

   Om du vill att `www.app.mellberg.online` också ska fungera lägger du till en separat A-post för `www.app` med samma IP.

4. **Vänta på verifiering**
   - Domänen visas som **Verifying** medan DNS sprids.
   - Detta kan ta upp till 72 timmar, men brukar gå betydligt snabbare.

5. **Sätt primär domän**
   - När status är **Active**, välj `app.mellberg.online` som **Primary domain**.
   - Den gamla `.lovable.app`-adressen kommer då att redirecta till den nya.

## Efter publicering
- Besökare når appen på `https://app.mellberg.online`.
- SSL-certifikatet provisioneras automatiskt av Lovable när domänen är verifierad.

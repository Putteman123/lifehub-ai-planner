# Kassaskåp

En ny låst vy i menyn där du sparar lösenord, pinkoder, anteckningar, skärmdumpar och filer. Vyn öppnas med Face ID (eller fingeravtryck) och som alternativ en sexsiffrig pinkod. Låset visas som ett animerat kassaskåp i samma stil som i Lexentia — dörren svänger upp när du låser upp och stängs igen när du låser.

## Så fungerar det

1. Du klickar på hänglås-ikonen "Kassaskåp" i vänstermenyn.
2. Kassaskåpet visas stängt med ratt och röd/grå lampa. Två sätt att öppna:
   - **Face ID** — knapp "Lås upp med Face ID". Första gången registrerar du enheten, sedan räcker ansiktet.
   - **Pinkod** — sexsiffrig knappsats (181718). Fel kod ger en liten skakning och röd lampa.
3. Vid rätt kod: ratten snurrar, lampan blir grön, dörren öppnas och innehållet tonas in.
4. Innehållet är öppet tills du låser manuellt, byter sida, eller efter 5 minuters inaktivitet — då stängs dörren igen.

## Innehåll i skåpet

- **Poster**: titel, typ (lösenord / pinkod / kod / anteckning), användarnamn, hemligt värde, webbadress, fritext.
  - Hemliga värden visas som prickar med ett öga för att visa och en knapp för att kopiera.
  - Sök på titel, och gruppering på typ.
- **Filer och skärmdumpar**: dra-och-släpp eller välj fil. Bilder visas som miniatyrer i ett rutnät, övriga filer som listrader med ikon och storlek. Klick öppnar förhandsvisning/nedladdning via tidsbegränsad länk.
- Redigera och ta bort med bekräftelse, precis som i Platser.

## Säkerhet

- Pinkoden lagras som en serverhemlighet och jämförs aldrig i webbläsaren (samma mönster som appens nuvarande pinkodslås).
- Filerna ligger i en privat lagringsyta — ingen publik länk, endast signerade länkar som går ut.
- Både poster och filer är låsta till ditt konto på databasnivå.
- Face ID sker på enheten via standarden för passnycklar; inget biometriskt lämnar telefonen.

## Teknisk plan

**Backend (migration)**
- Tabell `public.vault_items`: `id`, `user_id`, `kind` (enum `vault_kind`: `losenord`, `pinkod`, `kod`, `anteckning`), `title`, `username`, `secret`, `url`, `notes`, `created_at`, `updated_at` + `updated_at`-trigger.
- Tabell `public.vault_files`: `id`, `user_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `caption`, `created_at`.
- Tabell `public.vault_credentials` (passnycklar för Face ID): `id`, `user_id`, `credential_id`, `public_key`, `counter`, `created_at`.
- GRANT till `authenticated` (+ `service_role`), RLS på med `auth.uid() = user_id` på alla tre.
- Privat storage-bucket `kassaskap` via storage-verktyget + RLS-policyer på `storage.objects` där mappnamnet är användarens id.

**Pinkod**
- Ny hemlighet `VAULT_PIN` = `181718`.
- `src/lib/vault.functions.ts`: `unlockVault` (serverfunktion, konstant-tidsjämförelse, fördröjning vid fel) och `registerPasskey` / `verifyPasskey` för Face ID (WebAuthn-utmaning verifierad på servern mot `vault_credentials`).

**Frontend**
- `src/components/kassaskap/VaultAnimation.tsx` — kassaskåpsanimationen från Lexentia, portad till appens designtokens (ren CSS, respekterar `prefers-reduced-motion`), med lägen `stangd` / `oppnar` / `oppen` / `fel`.
- `src/components/kassaskap/VaultGate.tsx` — animation + Face ID-knapp + sexsiffrig knappsats (återanvänder mönstret från `auth.tsx`).
- `src/components/kassaskap/VaultItemDialog.tsx` och `VaultUpload.tsx`.
- `src/lib/vault.ts` — react-query-hooks (`useVaultItems`, `useVaultFiles`, uppladdning, signerade länkar).
- `src/routes/_authenticated/kassaskap.tsx` — route med egen `head()`-metadata, upplåsningsläge i komponentstate + 5 min inaktivitetstimer.
- `src/components/FloatingNav.tsx` — ny post `Kassaskåp` med `ShieldCheck`-ikon.
- Andrea får **inte** åtkomst till kassaskåpets innehåll; ingen kontext eller agentverktyg läggs till där.

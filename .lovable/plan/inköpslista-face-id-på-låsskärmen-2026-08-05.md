# Inköpslista + Face ID på låsskärmen

## Inköpslista

Ny vy **Handla** i vänstermenyn (kundvagnsikon).

**Fylla på listan**
- Ett fält högst upp: skriv en vara, tryck retur — den läggs till direkt i listan.
- Knappen **"Förgyll med Andrea"** fyller på listan med de dagligvaror du oftast handlar (baserat på din historik) plus vanliga basvaror. AI-tillagda varor är markerade och har en **soptunna** så du kan slänga dem direkt.
- Varje rad har soptunna, både AI-förslag och egna varor.

**När du handlar**
- Stora, tydliga knappar: hela raden är en tryckyta i handlingsläge (minst 64 px hög, stor text), lätt att träffa med en hand i butiken.
- Ett tryck = avbockad: raden får grön bock, tonas ned och glider ner till "I påsen" med en mjuk animation. Tryck igen ångrar.
- Räknare högst upp: "7 av 12 nedplockade" med en progressbar.

**Minne till nästa gång**
- Allt du skriver in sparas i ett eget varuregister med hur ofta och när du senast handlade det.
- Nästa gång du skapar en lista föreslås dina vanligaste varor överst ("Lägg till igen"-chips), och Andreas förgyllning använder samma register så förslagen blir personliga över tid.

**Klar-knappen**
- När du trycker **Klar** stängs listan med en avslutande animation (bocken fylls, kortet viks ihop) och det skapas en påminnelse som dyker upp under Påminnelser på översikten, t.ex. "Handlat: 12 varor" med tidpunkt — och listan arkiveras så varuregistret uppdateras.

## Face ID på låsskärmen

- På pinkodssidan läggs en stor **"Lås upp med Face ID"**-knapp till.
- Första gången: slå pinkoden en gång, sedan får du frågan "Vill du aktivera Face ID?" — enheten registreras som passnyckel.
- Därefter räcker ansiktet; pinkoden finns kvar som reserv.
- Inget biometriskt lämnar telefonen, verifieringen sker mot servern via passnyckelstandarden (samma teknik som kassaskåpet redan använder).

## Teknisk plan

**Migration**
- `shopping_lists`: `id`, `user_id`, `title`, `status` (`aktiv` | `klar`), `completed_at`.
- `shopping_items`: `id`, `user_id`, `list_id`, `name`, `quantity`, `category`, `is_checked`, `checked_at`, `source` (`manuell` | `ai`), `sort_order`.
- `pantry_items` (varuregister): `id`, `user_id`, `name` (unik per användare, normaliserad), `times_added`, `last_added_at`, `source`.
- `app_passkeys`: `id`, `credential_id`, `public_key`, `counter`, `label` — för inloggningens Face ID (utan `user_id`-koppling till session, ägs av appens enda konto).
- GRANT + RLS `auth.uid() = user_id` på de tre första; `app_passkeys` nekas helt för klienten och nås bara av serverfunktioner via admin. `updated_at`-triggers.

**Server**
- `src/lib/shopping.functions.ts`: `suggestShoppingItems` (Lovable AI Gateway, `openai/gpt-5.6-sol` via Responses API med strikt JSON-schema, prompt matas med toppvaror från `pantry_items`), `completeShoppingList` (bockar av listan, uppdaterar `pantry_items`, skapar rad i `reminders`).
- `src/lib/login-passkey.functions.ts`: `beginLoginPasskeyRegistration` / `finishLoginPasskeyRegistration` (kräver rätt `APP_PIN`), `beginLoginPasskey` / `finishLoginPasskey` (returnerar magic-link `tokenHash` precis som `unlockWithPin`). Återanvänder `src/lib/vault-webauthn.server.ts` och `vault_challenges`-mönstret.

**Frontend**
- `src/routes/_authenticated/handla.tsx` med egen `head()`-metadata.
- `src/components/handla/ShoppingList.tsx`, `ShoppingRow.tsx` (stor tryckyta + soptunna), `SuggestButton.tsx`, `FrequentChips.tsx`, `DoneOverlay.tsx` (klar-animation, respekterar `prefers-reduced-motion`).
- `src/lib/shopping.ts` — react-query-hooks och sortering/gruppering.
- `src/components/FloatingNav.tsx`: ny post "Handla" (`ShoppingCart`).
- `src/routes/auth.tsx`: Face ID-knapp + aktiveringsfråga efter lyckad pinkod.
- Agentverktyg i `src/lib/agent.server.ts`: `add_shopping_items` så Andrea kan lägga till varor i chatten.

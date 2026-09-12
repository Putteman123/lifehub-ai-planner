# Lägg till länk till vårddelen i huvudmenyn

Lägg till en tydlig genväg till LifeHub Vård (`/v`) i den flytande vänstermenyn och den utfällbara mobilmenyn, utan att ändra befintlig appstruktur eller data.

## Ändringar

1. **Menypost i `src/lib/nav-theme.ts`**
   - Lägg till `{ to: "/v", label: "Vård", icon: HeartPulse, color: "text-nav-vard" }` i `NAV_ITEMS`.
   - Lägg till posten i gruppen **Verktyg** i `NAV_GROUPS`.

2. **Färgtoken i `src/styles.css`**
   - Lägg till `--color-nav-vard: var(--nav-vard);` i `@theme inline`.
   - Lägg till `--nav-vard: oklch(0.55 0.13 25);` i `:root` (vårdig röd/rosa ton, tydligt skild från befintliga färger).

3. **Verifiering**
   - Kör typecheck (`bunx tsgo --noEmit`) och bekräfta att bygget är OK.
   - Kontrollera att länken visas i både flytande meny och mobilmeny och leder till `/v`.

## Tekniskt
- Inga ändringar i databasen, auth eller routes.
- Endast `src/lib/nav-theme.ts` och `src/styles.css` uppdateras.
- Route-filerna `/v` och `/v/organisationer` finns redan.

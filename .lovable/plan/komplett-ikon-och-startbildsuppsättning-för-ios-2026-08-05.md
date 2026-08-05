# Komplett ikon- och startbildsuppsättning för iOS

## Vad jag hittade

- Ikonerna finns (`favicon.png` 64px, `apple-touch-icon.png` 180px, `icon-192.png`, `icon-512.png`) och manifestet pekar rätt.
- **De 11 splash-bilderna i `public/` är inte inlänkade någonstans** — inga `apple-touch-startup-image`-taggar finns i appen, så iOS visar fortfarande en vit startskärm.
- Alla ikoner är sparade med transparens (RGBA). iOS stödjer inte transparens i hemskärmsikoner och fyller den med svart, vilket kan ge fula kanter.
- Manifestet saknar `maskable`-ikon (Android adaptiv ikon) och `apple-mobile-web-app`-taggarna saknas, så appen kan starta i Safari-läge på äldre iOS.

## Åtgärder

1. **Länka in startbilderna**: lägg till `apple-touch-startup-image`-länkar med `media`-queries för alla 11 befintliga upplösningar i `src/routes/__root.tsx`.
2. **Platta ut ikonerna**: skriv om `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` och `favicon.png` med solid bakgrund i appens blå ton istället för transparens.
3. **Lägg till fler ikonstorlekar**: `apple-touch-icon-152.png` (iPad) och `apple-touch-icon-167.png` (iPad Pro) plus `icon-maskable-512.png` med säker marginal för Android.
4. **Komplettera metadata** i `__root.tsx`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (`black-translucent`), `apple-mobile-web-app-title` ("LifeHub"), `theme-color`, samt `lang="sv"` på `<html>`.
5. **Uppdatera manifestet** med de nya ikonerna inklusive `purpose: "maskable"`.

## Teknisk detalj

Splash-länkarna genereras som en array i `head().links` med `media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"`-mönster per upplösning, mappade mot de filnamn som redan finns. Ikonerna plattas ut med `magick -background <hex> -alpha remove -alpha off`.

## Efter implementation

Du behöver ta bort appen från hemskärmen och lägga till den på nytt — iOS cachar ikon och startbild vid installation.

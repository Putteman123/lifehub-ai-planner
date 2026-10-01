# Renodla LifeHub och skapa en fristående AI-översikt

## Resultat
LifeHub blir åter en ren personlig app utan vårdsidor eller livo.health-gränssnitt. Befintlig vårddata lämnas orörd i databasen som säkerhetskopia. Superadmin får en egen AI-översikt i LifeHub, och appen får en ny modern ikon i riktningen **Lekfullt nav**.

## Genomförande

### 1. Ta bort vårddelen från LifeHub
- Ta bort de publika vårdsidorna, företagssidorna, demovyn, vårdinbjudningar och tillhörande vårdkomponenter.
- Ta bort vårdlänkar och vårdundermenyer från dator- och mobilmenyn.
- Ta bort livo.health-logik, domänomskrivningar, vårdtexter och vårdbilder från detta projekt.
- Lämna samtliga vårdtabeller och befintliga vårdposter orörda i databasen.
- Bevara fristående LifeHub-funktioner som inte hör till vården, inklusive den skrivskyddade GitHub-översikten, men placera dem utanför vårdstrukturen om de fortfarande länkas.

### 2. Fristående AI-översikt för superadmin
- Flytta AI-förbrukningen från vårdvägen till en egen LifeHub-sida, exempelvis `/ai`.
- Lägg länken i LifeHubs verktygsmeny och visa den endast för superadmin.
- Behåll serverkontrollen med strikt `is_app_owner === true` före varje dataläsning; dold meny är bara ett extra skydd.
- Visa antal och procent för Google, ChatGPT, Perplexity och Lovable för idag, veckan och månaden, ett färgat ringdiagram, prioriteringsordning, uppdateringstid samt ärligt tomt/fel/laddningsläge.
- Fortsätt endast logga leverantör, funktion och tidpunkt — aldrig frågor, svar, nycklar eller personuppgifter.

### 3. Ny LifeHub-appikon
- Skapa en ny kvadratisk ikon i stilen **Lekfullt nav** med marinblå bas, klarblå och korallrosa accenter samt ljusa detaljer.
- Formen ska vara tydlig även i liten mobilstorlek, utan text och utan vård- eller livo.health-symbolik.
- Kontrollera resultatet på både ljus och mörk bakgrund och förfina konkreta läsbarhetsproblem.
- Byt favicon, mobilikoner, maskbar ikon, Apple-ikon och manifestets namn/färger till LifeHub. Uppdatera startbilderna så den gamla vårdprofilen inte ligger kvar.

### 4. Städning och verifiering
- Ta bort kvarvarande oanvänd vårdkod och vårdresurser utan att röra databasen.
- Lägg fokuserade tester för AI-sidans superadminåtkomst och nekad åtkomst före dataläsning.
- Kontrollera att inga synliga länkar till vård eller livo.health finns kvar.
- Testa AI-översikten som superadmin och som vanlig användare, samt kontrollera menyn och ikonerna på dator och mobil.
- Kör hela testsviten, typkontroll och byggkontroll. Publicera inte appen.

## Tekniskt
- Route-strukturen regenereras av appens befintliga router; den genererade filen redigeras inte manuellt.
- Databasschemat ändras inte i denna uppgift.
- Befintliga AI-händelser i `ai_usage_events` återanvänds så historiken följer med till den nya sidan.

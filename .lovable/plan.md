# Hämta nya filer från GitHub till appen

## Så fungerar det redan
Appen är kopplad till GitHub-repot (Putteman123/lifehub-ai-planner, gren main) med tvåvägssynk. Allt som läggs på grenen **main** på GitHub hämtas in i appen automatiskt. Ingen ny funktion behöver byggas.

## Vad du gör
1. Lägg in eller ändra filerna på GitHub och spara (commit) dem på grenen **main**.
2. Vänta någon minut – ändringarna dyker upp här och i förhandsvisningen.
3. Om något inte kommer in: öppna Projektinställningar → Git och kolla status. Står det att GitHub ligger före, gör en ny liten ändring på main så hämtas allt in.
4. Ändringar på andra grenar än main hämtas inte – slå ihop dem till main först.

## Efter att filerna kommit in
Säg till här, så går jag igenom de nya filerna, rättar eventuella fel och kollar att appen fungerar. Publicering till mellberg.online sker bara när du ber om det.

## Teknisk not
Ingen kodändring. Synken styrs av Lovables Git-koppling; databasändringar i nya filer körs inte automatiskt utan läggs in härifrån vid behov.

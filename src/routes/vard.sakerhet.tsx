import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, KeyRound, Lock, Server } from "lucide-react";

import { CareCard, CareSection } from "@/components/care/CareChrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vard/sakerhet")({
  head: () => ({
    meta: [
      { title: "Säkerhet, samtycke och integritet – livo.health" },
      {
        name: "description",
        content:
          "Roller, samtycken och loggning från start. Varje person ser bara sin egen information, och AI:n har begränsade befogenheter.",
      },
      { property: "og:title", content: "Säkerhet och integritet i livo.health" },
      {
        property: "og:description",
        content: "Strikt behörighetsstyrning, samtycken och loggade läsningar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SakerhetPage,
});

function SakerhetPage() {
  return (
    <>
      <CareSection eyebrow="Säkerhet" title="Byggt för känsliga uppgifter från första dagen">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Även under alfatest med påhittade brukare gäller samma regler som i skarp drift.
          Behörigheter styrs i databasen, inte bara i gränssnittet.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <CareCard title="Roller styr allt" icon={<KeyRound className="size-6" />}>
            Superadmin, verksamhetsadmin, vårdpersonal, brukare och anhörig. Varje roll når bara sin
            egen information.
          </CareCard>
          <CareCard title="Samtycke per del" icon={<Eye className="size-6" />}>
            Anhöriga får se det brukaren godkänt – medicin, besök, schema, inköp eller ekonomi, var
            för sig.
          </CareCard>
          <CareCard title="Skyddad data" icon={<Lock className="size-6" />}>
            Åtkomsten kontrolleras rad för rad i databasen, så en felaktig förfrågan helt enkelt inte
            får något svar.
          </CareCard>
          <CareCard title="Spårbarhet" icon={<Server className="size-6" />}>
            Känsliga läsningar och ändringar loggas, så det går att följa upp vem som sett vad.
          </CareCard>
        </div>
        <div className="mt-10 rounded-md border border-border/70 bg-card p-6 text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">AI med tydliga gränser</p>
          <p className="mt-2">
            Assistenten hjälper till med schemaimport, ordning på besöken och enkla frågor från
            brukaren. Den fattar inga vårdbeslut och kan inte ändra medicinlistor på egen hand.
          </p>
        </div>
        <Button asChild size="lg" className="mt-10">
          <Link to="/vard/kontakt">Ställ frågor om säkerheten</Link>
        </Button>
      </CareSection>
    </>
  );
}

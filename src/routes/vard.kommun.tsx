import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, Layers, LineChart } from "lucide-react";

import { CareCard, CareSection } from "@/components/care/CareChrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vard/kommun")({
  head: () => ({
    meta: [
      { title: "För kommun, region och privata vårdaktörer – livo.health" },
      {
        name: "description",
        content:
          "Skapa organisationer, styr vilka moduler varje verksamhet får och låt admin lägga schema med adress, uppgifter och tid.",
      },
      { property: "og:title", content: "livo.health för kommun och region" },
      {
        property: "og:description",
        content: "Organisationer, roller och moduler som styrs uppifrån och ned.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KommunPage,
});

function KommunPage() {
  return (
    <>
      <CareSection
        eyebrow="Kommun, region och privata utförare"
        title="En struktur som växer med verksamheten"
      >
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Varje huvudman får en egen organisation med sina enheter, sin personal och sina brukare.
          Vi som systemägare bestämmer vilka moduler organisationen får tillgång till. Därefter
          bestämmer verksamheten själv vad som ska vara igång, och vem som ser vad.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <CareCard title="Organisation och enheter" icon={<Building2 className="size-6" />}>
            Lägg upp verksamheten en gång. Enheter, personal och brukare hänger ihop under samma tak
            med tydlig ansvarsfördelning.
          </CareCard>
          <CareCard title="Moduler som tilldelas" icon={<Layers className="size-6" />}>
            Schema, medicin, karta, uppgifter, handla och AI-assistent. Verksamheten kan bara slå på
            det som blivit tilldelat.
          </CareCard>
          <CareCard title="Schema med innehåll" icon={<ClipboardList className="size-6" />}>
            Admin lägger in besök med adress, arbetsuppgifter och förväntad tid – personalen ser det
            direkt i sin dag.
          </CareCard>
          <CareCard title="Uppföljning" icon={<LineChart className="size-6" />}>
            Utförda besök, avprickade uppgifter och medicin ger ett underlag som växer efterhand.
          </CareCard>
        </div>
      </CareSection>

      <CareSection eyebrow="Så kommer ni igång" title="Tre steg till en pilot">
        <ol className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <li className="rounded-md border border-border/70 bg-card p-5">
            <span className="font-semibold text-foreground">1. Vi skapar organisationen</span> och
            tilldelar de moduler ni ska prova.
          </li>
          <li className="rounded-md border border-border/70 bg-card p-5">
            <span className="font-semibold text-foreground">2. Er admin bjuder in personal</span> och
            lägger in ett par dagars schema med påhittade brukare.
          </li>
          <li className="rounded-md border border-border/70 bg-card p-5">
            <span className="font-semibold text-foreground">3. Ni kör en vecka</span> och vi justerar
            uppgifter, tider och vyer efter hur det faktiskt fungerar.
          </li>
        </ol>
        <Button asChild size="lg" className="mt-8">
          <Link to="/vard/kontakt">Begär offert eller demo</Link>
        </Button>
      </CareSection>
    </>
  );
}

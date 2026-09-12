import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Navigation, Pill, ShoppingBasket } from "lucide-react";

import careRoute from "@/assets/care-route.jpg";
import { CareCard, CareSection } from "@/components/care/CareChrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vard/personal")({
  head: () => ({
    meta: [
      { title: "Vårdpersonalens dag – schema, uppgifter och rutt | LifeHub Vård" },
      {
        name: "description",
        content:
          "Personalen får dagens besök, uppgifter att pricka av, medicinlista och bästa väg efter dagens färdsätt.",
      },
      { property: "og:title", content: "Vårdpersonalens vy i LifeHub Vård" },
      {
        property: "og:description",
        content: "Dagens schema, uppgifter, medicin och karta – utan ekonomi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PersonalPage,
});

function PersonalPage() {
  return (
    <>
      <CareSection eyebrow="Vårdpersonal" title="Dagen i telefonen, utan krångel">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Personalen loggar in och ser dagens besök i tur och ordning: vem, var, vilka uppgifter
              som ska göras och hur lång tid besöket är beräknat att ta.
            </p>
            <p>
              Uppgifter kryssas av efter hand. Ekonomi finns inte med i den här vyn – varken
              brukarens eller verksamhetens.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border/70">
            <img
              src={careRoute}
              alt="Vårdpersonal med mobilen och dagens rutt"
              width={1200}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <CareCard title="Uppgifter att pricka av" icon={<CheckCircle2 className="size-6" />}>
            Varje besök har sin checklista. Klart är klart, och det syns för dem som ska veta.
          </CareCard>
          <CareCard title="Medicin" icon={<Pill className="size-6" />}>
            Egen flik med brukarens mediciner som kryssas när de delats ut.
          </CareCard>
          <CareCard title="Karta och färdsätt" icon={<Navigation className="size-6" />}>
            Bästa väg beroende på om dagen körs med bil, kollektivt eller till fots.
          </CareCard>
          <CareCard title="Handla" icon={<ShoppingBasket className="size-6" />}>
            Inköpslistan följer med, med stöd av skafferiet. Näthandel kopplas på senare.
          </CareCard>
        </div>
        <Button asChild size="lg" className="mt-10">
          <Link to="/vard/kontakt">Prova med er personalgrupp</Link>
        </Button>
      </CareSection>
    </>
  );
}

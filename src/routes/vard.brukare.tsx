import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarHeart, HeartHandshake, MessageCircleHeart, ShieldCheck } from "lucide-react";

import careMedicine from "@/assets/care-medicine.jpg";
import { CareCard, CareSection } from "@/components/care/CareChrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vard/brukare")({
  head: () => ({
    meta: [
      { title: "Brukare och anhöriga – dagens schema, medicin och insyn | livo.health" },
      {
        name: "description",
        content:
          "Brukaren ser dagens besök, aktiviteter och medicintider. Anhöriga följer medicin, besök och inköp – med samtycke.",
      },
      { property: "og:title", content: "livo.health för brukare och anhöriga" },
      {
        property: "og:description",
        content: "Trygg insyn i vardagen, alltid på brukarens villkor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrukarePage,
});

function BrukarePage() {
  return (
    <>
      <CareSection eyebrow="Brukare" title="Dagen som den är, i stora tydliga steg">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Brukaren ser vad som står på dagens schema: aktiviteter, besök från vården, besök av
              anhöriga och vänner samt när det är dags att ta medicin.
            </p>
            <p>
              Om vårdgivaren är på väg och brukaren står näst på tur går det att se var hjälpen
              befinner sig – inget mer väntande i ovisshet.
            </p>
          </div>
          <div className="overflow-hidden rounded-md border border-border/70">
            <img
              src={careMedicine}
              alt="Medicinlista och dagens schema visat på en surfplatta"
              width={1200}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <CareCard title="Dagens schema" icon={<CalendarHeart className="size-6" />}>
            Besök, aktiviteter och medicintider i en enda lugn lista.
          </CareCard>
          <CareCard title="Fråga Andrea" icon={<MessageCircleHeart className="size-6" />}>
            En trygg AI-assistent för de viktigaste frågorna – eller för att be om något extra i
            inköpslistan.
          </CareCard>
        </div>
      </CareSection>

      <CareSection eyebrow="Anhöriga" title="Insyn – men bara med samtycke">
        <div className="grid gap-5 sm:grid-cols-2">
          <CareCard title="Följ vardagen" icon={<HeartHandshake className="size-6" />}>
            Se om medicinen är tagen, om vården varit där, hur schemat ser ut och vad som handlats.
          </CareCard>
          <CareCard title="Brukaren bestämmer" icon={<ShieldCheck className="size-6" />}>
            Varje del delas separat, inklusive ekonomi. Samtycket kan ändras eller tas bort när som
            helst.
          </CareCard>
        </div>
        <Button asChild size="lg" className="mt-10">
          <Link to="/vard/kontakt">Vill ni prova i er verksamhet?</Link>
        </Button>
      </CareSection>
    </>
  );
}

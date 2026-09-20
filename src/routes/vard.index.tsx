import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Map, Pill, ShieldCheck, Sparkles, Users } from "lucide-react";

import careHero from "@/assets/care-hero.jpg";
import livoLogo from "@/assets/livo-health-logo.png";
import careMedicine from "@/assets/care-medicine.jpg";
import careRoute from "@/assets/care-route.jpg";
import { CareCard, CareSection } from "@/components/care/CareChrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vard/")({
  head: () => ({
    meta: [
      { title: "livo.health – Digital Omsorgslösning" },
      {
        name: "description",
        content:
          "Digitalt stöd för hemsjukvård: schema med adress och uppgifter, medicinlista att pricka av, ruttplanering och insyn för brukare och anhöriga.",
      },
      { property: "og:title", content: "livo.health – trygg digital omsorg i vardagen" },
      {
        property: "og:description",
        content:
          "Ett system för kommun, region och privata vårdaktörer – från schema till medicin och samtycke.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CareHome,
});

function CareHome() {
  return (
    <>
      <section className="care-hero-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <div className="care-rise">
            <img
              src={livoLogo}
              alt="livo.health – Digital Omsorgslösning"
              width={530}
              height={133}
              className="mb-8 h-auto w-full max-w-sm"
            />
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" /> Byggt för hemsjukvård
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Hela dagen på plats – från schema till utdelad medicin
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              livo.health samlar besök, uppgifter, mediciner och resvägar i ett lugnt gränssnitt.
              Verksamheten planerar, personalen prickar av, brukaren ser sin dag och anhöriga får
              insyn – alltid med samtycke.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/vard/kontakt">Boka en demo</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/vard/kommun">För kommun och region</Link>
              </Button>
            </div>
          </div>
          <div className="care-rise overflow-hidden rounded-md border border-border/70 shadow-lg">
            <img
              src={careHero}
              alt="Vårdpersonal visar dagens schema i mobilen för en äldre kvinna hemma"
              width={1600}
              height={1008}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <CareSection eyebrow="Tre saker som gör skillnad" title="Enkelt för alla som är med i vardagen">
        <div className="grid gap-5 md:grid-cols-3">
          <CareCard title="Schema som håller" icon={<CalendarCheck className="size-6" />}>
            Adress, arbetsuppgifter och förväntad besökstid – lagt en gång, synligt för rätt person.
          </CareCard>
          <CareCard title="Medicin i egen flik" icon={<Pill className="size-6" />}>
            Samma medicinlista i alla vyer, kryssas när dosen är utdelad och syns direkt för anhöriga.
          </CareCard>
          <CareCard title="Trygghet med samtycke" icon={<ShieldCheck className="size-6" />}>
            Brukaren bestämmer vad anhöriga får se, och kan ta tillbaka samtycket när som helst.
          </CareCard>
        </div>
      </CareSection>

      <CareSection eyebrow="Ute på vägarna" title="Rätt väg till nästa besök">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-border/70">
            <img
              src={careRoute}
              alt="Vårdpersonal planerar rutten till nästa besök från bilen"
              width={1200}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Personalen väljer dagens färdsätt – bil, kollektivt eller gång och cykel – och får
              besöken i en ordning som håller tidsplanen. Kartan visar vägen och restiden räknas in i
              schemat.
            </p>
            <p>
              Brukaren kan se att hjälpen är på väg när han eller hon står näst på tur, utan att
              någon behöver ringa och fråga.
            </p>
            <Button asChild variant="outline">
              <Link to="/vard/personal">Så fungerar personalvyn</Link>
            </Button>
          </div>
        </div>
      </CareSection>

      <CareSection eyebrow="Hemma hos brukaren" title="En lugn dag som går att följa">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Brukaren ser dagens schema: besök från vården, aktiviteter, besök av anhöriga och när
              det är dags att ta medicin. Vill man ha något extra handlat går det att be om det
              direkt i appen.
            </p>
            <p>
              Anhöriga ser att medicinen är tagen, att besöket blivit av och vad som är inhandlat –
              exakt så mycket som brukaren gett samtycke till.
            </p>
            <Button asChild variant="outline">
              <Link to="/vard/brukare">För brukare och anhöriga</Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border border-border/70">
            <img
              src={careMedicine}
              alt="Medicindosett och en enkel checklista på en surfplatta"
              width={1200}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </CareSection>

      <CareSection eyebrow="Fyra vyer, en grund" title="Alla ser precis sitt – inget annat">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <CareCard title="Verksamhetsadmin" icon={<Users className="size-6" />}>
            Lägger schema med adress, uppgifter och tid. Ser personal och brukare – aldrig ekonomi.
          </CareCard>
          <CareCard title="Vårdpersonal" icon={<Map className="size-6" />}>
            Dagens besök, uppgifter att pricka av, karta och medicin. Ingen ekonomi.
          </CareCard>
          <CareCard title="Brukare" icon={<CalendarCheck className="size-6" />}>
            Dagens schema, besök, medicintider och en trygg AI-assistent för det viktigaste.
          </CareCard>
          <CareCard title="Anhörig" icon={<ShieldCheck className="size-6" />}>
            Följer medicin, besök, schema och inköp – och ekonomi endast om samtycke finns.
          </CareCard>
        </div>
        <div className="mt-10 rounded-md border border-border/70 bg-card p-8 text-center shadow-sm">
          <h3 className="font-display text-xl font-semibold">Vill ni se det i praktiken?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Vi visar systemet på en halvtimme och sätter upp en pilot med påhittade brukare, så att
            ni kan prova utan att röra riktiga uppgifter.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/vard/kontakt">Boka demo</Link>
          </Button>
        </div>
      </CareSection>
    </>
  );
}

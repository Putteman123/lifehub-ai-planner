import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Scale, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeHub AI – din personliga AI-assistent för hela livet" },
      {
        name: "description",
        content:
          "Samla jobb, juristuppdrag, barnens aktiviteter och privatliv i en intelligent kalender med AI-sammanfattningar och ledig tid.",
      },
      { property: "og:title", content: "LifeHub AI – överblick över hela ditt liv" },
      {
        property: "og:description",
        content:
          "En intelligent kalender som samlar alla dina kalendrar, hittar luckor och planerar din tid.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarDays,
    title: "En intelligent kalender",
    text: "Alla kalendrar i samma vy – dag, vecka, månad, år och agenda med färgkodning.",
  },
  {
    icon: Users,
    title: "Barnen i fokus",
    text: "Träningar, matcher, skola och veckorna du har barnen hos dig.",
  },
  {
    icon: Scale,
    title: "Juristarbetsyta",
    text: "Klientmöten, förhandlingar, tidsfrister och uppgifter per ärende.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          LifeHub AI
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Logga in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="pt-10 sm:pt-20">
          <p className="text-sm font-medium text-primary">Arbete · Familj · Privatliv</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Hela ditt liv i en enda intelligent kalender
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            LifeHub AI samlar jobb, juristuppdrag, barnens aktiviteter och privatliv. AI:n
            sammanfattar dagen, hittar lediga luckor och upptäcker krockar innan de händer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Kom igång</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="card-soft p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

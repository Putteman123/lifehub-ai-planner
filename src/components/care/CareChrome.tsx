import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import livoLogo from "@/assets/livo-health-logo.png";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/vard/kommun", label: "Kommun & region" },
  { to: "/vard/personal", label: "Vårdpersonal" },
  { to: "/vard/brukare", label: "Brukare & anhöriga" },
  { to: "/vard/sakerhet", label: "Säkerhet" },
] as const;

export function CareHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2">
        <Link to="/vard" className="flex shrink-0 items-center" aria-label="livo.health – startsida">
          <img src={livoLogo} alt="livo.health – Digital Omsorgslösning" width={265} height={67} className="h-11 w-auto sm:h-12" />
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
          <Button asChild size="sm" className="ml-2">
            <Link to="/vard/kontakt">Boka demo</Link>
          </Button>
        </nav>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Öppna meny"
          className="ml-auto flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="border-t border-border/70 px-4 pb-3 md:hidden">
          <div className="flex flex-col py-2">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-muted-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Button asChild size="sm" className="mt-2">
              <Link to="/vard/kontakt" onClick={() => setOpen(false)}>
                Boka demo
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function CareFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 bg-secondary/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <img src={livoLogo} alt="livo.health" width={212} height={53} className="h-11 w-auto" loading="lazy" />
        </div>
        <div className="flex flex-wrap gap-4">
          <Link to="/vard/sakerhet" className="hover:text-foreground">
            Säkerhet och integritet
          </Link>
          <Link to="/vard/kontakt" className="hover:text-foreground">
            Kontakt
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function CareSection({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-6xl px-4 py-14 ${className}`}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
      ) : null}
      <div className="mt-7">{children}</div>
    </section>
  );
}

export function CareCard({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="care-rise rounded-md border border-border/70 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
      {icon ? <div className="mb-4 text-primary">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import careLogo from "@/assets/care-logo.png";

export const Route = createFileRoute("/_authenticated/v")({
  component: CareAppLayout,
});

const LINKS = [
  { to: "/v", label: "Översikt", exact: true },
  { to: "/v/organisationer", label: "Kunder", exact: false },
  { to: "/v/samtal", label: "Samtal", exact: false },
] as const;

function CareAppLayout() {
  return (
    <div className="care-theme min-h-screen">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src={careLogo} alt="" width={32} height={32} className="size-8" />
          <span className="font-display font-semibold">LifeHub Vård</span>
          <nav className="ml-auto flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.exact }}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

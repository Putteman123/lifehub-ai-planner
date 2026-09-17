import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import careLogo from "@/assets/care-logo.png";
import { APP_VERSION } from "@/lib/nav-theme";
import { listMyAdminOrgs } from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v")({
  component: CareAppLayout,
});

function CareAppLayout() {
  const fetchOrgs = useServerFn(listMyAdminOrgs);
  const { data: orgs } = useQuery({
    queryKey: ["care-my-admin-orgs"],
    queryFn: () => fetchOrgs({}),
  });

  const first = (orgs ?? []).find((o) => o?.slug) as { slug: string } | undefined;

  return (
    <div className="care-theme min-h-screen">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <img src={careLogo} alt="" width={32} height={32} className="size-8" />
          <span className="font-display font-semibold">LifeHub Vård</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
            Alfa 1.0
          </span>
          <nav className="ml-auto flex flex-wrap items-center gap-1">
            <Item to="/v" label="Översikt" exact />
            <Item to="/v/organisationer" label="Kunder" />
            {first ? (
              <Link
                to="/v/f/$slug"
                params={{ slug: first.slug }}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                Verksamhet
              </Link>
            ) : null}
            <Item to="/v/samtal" label="Samtal" />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted-foreground">
        LifeHub Vård · version {APP_VERSION}
      </footer>
    </div>
  );
}

function Item({
  to,
  label,
  exact,
}: {
  to: "/v" | "/v/organisationer" | "/v/samtal";
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {label}
    </Link>
  );
}

import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/v/f/$slug")({
  component: CompanyAdminLayout,
});

type TabPath =
  | "/v/f/$slug"
  | "/v/f/$slug/brukare"
  | "/v/f/$slug/schema"
  | "/v/f/$slug/karta"
  | "/v/f/$slug/rapporter"
  | "/v/f/$slug/medicin"
  | "/v/f/$slug/insatser";

function CompanyAdminLayout() {
  const { slug } = Route.useParams();
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card p-1">
        <Tab to="/v/f/$slug" slug={slug} exact label="Personal" />
        <Tab to="/v/f/$slug/brukare" slug={slug} label="Brukare" />
        <Tab to="/v/f/$slug/schema" slug={slug} label="Schema" />
        <Tab to="/v/f/$slug/karta" slug={slug} label="Karta & rutter" />
        <Tab to="/v/f/$slug/insatser" slug={slug} label="Insatser" />
        <Tab to="/v/f/$slug/medicin" slug={slug} label="Medicin" />
        <Tab to="/v/f/$slug/rapporter" slug={slug} label="Rapporter" />
      </nav>
      <Outlet />
    </div>
  );
}

function Tab({
  to,
  slug,
  label,
  exact,
}: {
  to: TabPath;
  slug: string;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: exact ?? false }}
      className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {label}
    </Link>
  );
}

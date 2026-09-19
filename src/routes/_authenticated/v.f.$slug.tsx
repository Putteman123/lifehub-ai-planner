import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ContactDrawer } from "@/components/care/ContactDrawer";
import { DemoRoleSwitcher } from "@/components/care/DemoRoleSwitcher";
import { DEMO_ROLE_TABS, DemoRoleProvider, demoRoleLabel, useDemoRole } from "@/lib/demo-role";

/** Kopierar den publika demolänken (pinkod 0000) till urklipp. */
function ShareDemoButton({ slug }: { slug: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        // På en företagssubdomän pekar origin fel – använd alltid huvuddomänen.
        const { protocol, host } = window.location;
        const base = host.endsWith(".mellberg.online")
          ? `${protocol}//mellberg.online`
          : `${protocol}//${host}`;
        const url = `${base}/demo/${slug}`;
        void navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Demolänk kopierad – pinkod 0000."))
          .catch(() => toast.error(url));
      }}
    >
      Dela demo
    </Button>
  );
}

export const Route = createFileRoute("/_authenticated/v/f/$slug")({
  component: CompanyAdminLayoutWrapper,
});

type TabPath =
  | "/v/f/$slug"
  | "/v/f/$slug/brukare"
  | "/v/f/$slug/schema"
  | "/v/f/$slug/karta"
  | "/v/f/$slug/rapporter"
  | "/v/f/$slug/medicin"
  | "/v/f/$slug/handla"
  | "/v/f/$slug/ekonomi"
  | "/v/f/$slug/insatser";

const TABS: { key: string; to: TabPath; label: string; exact?: boolean }[] = [
  { key: "personal", to: "/v/f/$slug", label: "Personal", exact: true },
  { key: "brukare", to: "/v/f/$slug/brukare", label: "Brukare" },
  { key: "schema", to: "/v/f/$slug/schema", label: "Schema" },
  { key: "karta", to: "/v/f/$slug/karta", label: "Karta & rutter" },
  { key: "insatser", to: "/v/f/$slug/insatser", label: "Insatser" },
  { key: "medicin", to: "/v/f/$slug/medicin", label: "Medicin" },
  { key: "handla", to: "/v/f/$slug/handla", label: "Handla" },
  { key: "ekonomi", to: "/v/f/$slug/ekonomi", label: "Ekonomi" },
  { key: "rapporter", to: "/v/f/$slug/rapporter", label: "Rapporter" },
];

function CompanyAdminLayoutWrapper() {
  return (
    <DemoRoleProvider>
      <CompanyAdminLayout />
    </DemoRoleProvider>
  );
}

function CompanyAdminLayout() {
  const { slug } = Route.useParams();
  const { role } = useDemoRole();
  const allowed = DEMO_ROLE_TABS[role];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card p-1">
          {TABS.filter((tab) => allowed.includes(tab.key)).map((tab) => (
            <Tab key={tab.key} to={tab.to} slug={slug} label={tab.label} exact={tab.exact === true} />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ContactDrawer />
          {slug === "alfa-demo" ? <ShareDemoButton slug={slug} /> : null}
          <DemoRoleSwitcher />
        </div>
      </div>

      {role !== "admin" ? (
        <p className="rounded-2xl border border-border/70 bg-secondary/60 px-4 py-2 text-sm text-muted-foreground">
          Demoläge: du ser systemet som <strong>{demoRoleLabel(role)}</strong>. Byt tillbaka till
          Verksamhetsadmin för alla delar.
        </p>
      ) : null}

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

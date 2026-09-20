import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ContactDrawer } from "@/components/care/ContactDrawer";
import { DemoRoleSwitcher } from "@/components/care/DemoRoleSwitcher";
import { DEMO_ROLE_TABS, DemoRoleProvider, demoRoleLabel, useDemoRole } from "@/lib/demo-role";
import { BarChart3, CalendarDays, ClipboardCheck, MapPinned, PackageCheck, Pill, ShoppingBasket, UsersRound, WalletCards } from "lucide-react";

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
          ? `${protocol}//livo.health`
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

const TABS = [
  { key: "personal", to: "/v/f/$slug", label: "Personal", icon: UsersRound, exact: true },
  { key: "brukare", to: "/v/f/$slug/brukare", label: "Brukare", icon: PackageCheck },
  { key: "schema", to: "/v/f/$slug/schema", label: "Schema", icon: CalendarDays },
  { key: "karta", to: "/v/f/$slug/karta", label: "Karta & rutter", icon: MapPinned },
  { key: "insatser", to: "/v/f/$slug/insatser", label: "Insatser", icon: ClipboardCheck },
  { key: "medicin", to: "/v/f/$slug/medicin", label: "Medicin", icon: Pill },
  { key: "handla", to: "/v/f/$slug/handla", label: "Handla", icon: ShoppingBasket },
  { key: "ekonomi", to: "/v/f/$slug/ekonomi", label: "Ekonomi", icon: WalletCards },
  { key: "rapporter", to: "/v/f/$slug/rapporter", label: "Rapporter", icon: BarChart3 },
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
        <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border/70 bg-card p-1 shadow-sm">
          {TABS.filter((tab) => allowed.includes(tab.key)).map((tab) => (
            <Tab key={tab.key} to={tab.to} slug={slug} label={tab.label} icon={tab.icon} exact={tab.exact === true} />
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
  icon: Icon,
  exact,
}: {
  to: TabPath;
  slug: string;
  label: string;
  icon: typeof UsersRound;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: exact ?? false }}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
      activeProps={{ className: "bg-primary text-primary-foreground" }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

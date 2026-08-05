import { Link, useNavigate } from "@tanstack/react-router";
import {
  Baby,
  CalendarDays,
  LayoutDashboard,
  Lock,
  Scale,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Andrea } from "@/components/andrea/Andrea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/barn", label: "Barn", icon: Baby },
  { to: "/jurist", label: "Jurist", icon: Scale },
  { to: "/kalendrar", label: "Kalendrar", icon: Settings2 },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function lockApp() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">LifeHub AI</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{
                className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" size="sm" className="justify-start gap-3" onClick={lockApp}>
          <Lock className="size-4" />
          Lås appen
        </Button>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              {subtitle ? (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </header>
        <main className="px-4 pb-28 pt-5 sm:px-6 md:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <Andrea />
    </div>
  );
}

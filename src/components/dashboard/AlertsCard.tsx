import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight } from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
import { useAlertNotifications, useAlerts } from "@/lib/alerts";

const TONE: Record<string, string> = {
  utgift: "bg-nav-pengar/15 text-nav-pengar",
  iptv: "bg-nav-iptv/15 text-nav-iptv",
  budget: "bg-destructive/15 text-destructive",
  uppgift: "bg-nav-attgora/15 text-nav-attgora",
};

/** Proaktiva notiser: förfallodatum, IPTV, budget och deadlines. */
export function AlertsCard() {
  const alerts = useAlerts();
  useAlertNotifications(alerts);

  if (alerts.length === 0) return null;

  return (
    <SectionCard
      title="Kräver din uppmärksamhet"
      icon={Bell}
      accent="text-destructive"
      tint="bg-destructive/12"
      count={alerts.length}
    >
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id}>
            <Link
              to={a.to}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3 transition-colors hover:bg-accent"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${TONE[a.kind] ?? "bg-muted"}`}
              >
                {a.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useFixedExpenses, useFixedPayments, useSpends } from "@/lib/finance";
import { useTodos } from "@/lib/db";

export type Alert = {
  id: string;
  kind: "utgift" | "iptv" | "budget" | "uppgift";
  title: string;
  detail: string;
  /** Lägre tal = mer brådskande. */
  urgency: number;
  to: string;
};

const kr = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(n)) + " kr";

const dayMs = 86_400_000;

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / dayMs);
}

/** IPTV-linjer som snart går ut. */
function useIptvLines() {
  return useQuery({
    queryKey: ["iptv_lines", "alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iptv_lines")
        .select("id, customer_name, expires_at, status");
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Proaktiva notiser: fasta utgifter som förfaller, IPTV som går ut,
 * budgetavvikelser och uppgifter med deadline.
 */
export function useAlerts(): Alert[] {
  const fixedQ = useFixedExpenses();
  const paymentsQ = useFixedPayments();
  const spendsQ = useSpends();
  const todosQ = useTodos();
  const iptvQ = useIptvLines();

  return useMemo(() => {
    const out: Alert[] = [];
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const paid = new Set(
      (paymentsQ.data ?? []).filter((p) => p.period === period).map((p) => p.expense_id),
    );

    for (const f of fixedQ.data ?? []) {
      if (!f.is_active || paid.has(f.id)) continue;
      const left = f.due_day - now.getDate();
      if (left > 5 || left < -60) continue;
      out.push({
        id: `fixed-${f.id}`,
        kind: "utgift",
        title: f.name,
        detail:
          left < 0
            ? `Förfallen sedan ${Math.abs(left)} dagar · ${kr(Number(f.amount))}`
            : `Förfaller om ${left} dagar · ${kr(Number(f.amount))}`,
        urgency: left,
        to: "/pengar",
      });
    }

    for (const line of iptvQ.data ?? []) {
      if (!line.expires_at) continue;
      const left = daysUntil(line.expires_at);
      if (left > 14 || left < -30) continue;
      out.push({
        id: `iptv-${line.id}`,
        kind: "iptv",
        title: line.customer_name,
        detail: left < 0 ? `Utgången sedan ${Math.abs(left)} dagar` : `Går ut om ${left} dagar`,
        urgency: left,
        to: "/iptv",
      });
    }

    for (const t of todosQ.data ?? []) {
      if (t.is_done || !t.due_date) continue;
      const left = daysUntil(t.due_date);
      if (left > 2 || left < -30) continue;
      out.push({
        id: `todo-${t.id}`,
        kind: "uppgift",
        title: t.title,
        detail: left < 0 ? `Försenad ${Math.abs(left)} dagar` : left === 0 ? "Idag" : `Om ${left} dagar`,
        urgency: left,
        to: "/attgora",
      });
    }

    // Budget: jämför denna månad mot samma antal dagar förra månaden.
    const spends = spendsQ.data ?? [];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const dayCut = now.getDate() * dayMs;
    const sum = (from: number) =>
      spends
        .filter((s) => {
          const t = new Date(s.spent_at).getTime();
          return t >= from && t < from + dayCut;
        })
        .reduce((acc, s) => acc + Number(s.amount), 0);
    const thisMonth = sum(monthStart);
    const prevMonth = sum(prevStart);
    if (prevMonth > 0 && thisMonth > prevMonth * 1.25) {
      out.push({
        id: "budget-overspend",
        kind: "budget",
        title: "Högre utgifter än vanligt",
        detail: `${kr(thisMonth)} hittills mot ${kr(prevMonth)} samma tid förra månaden`,
        urgency: 0,
        to: "/pengar",
      });
    }

    return out.sort((a, b) => a.urgency - b.urgency).slice(0, 12);
  }, [fixedQ.data, paymentsQ.data, spendsQ.data, todosQ.data, iptvQ.data]);
}

const SEEN_KEY = "lifehub_alerts_seen";

/** Skickar en lokal avisering per ny notis, max en gång per dag och notis. */
export function useAlertNotifications(alerts: Alert[]) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== "granted" || alerts.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    let seen: Record<string, string> = {};
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}");
    } catch {
      seen = {};
    }
    let changed = false;
    for (const a of alerts) {
      if (a.urgency > 1 || seen[a.id] === today) continue;
      new Notification(a.title, { body: a.detail, icon: "/icons/icon-192.png", tag: a.id });
      seen[a.id] = today;
      changed = true;
    }
    if (changed) localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }, [alerts, permission]);

  async function enable() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  }

  return { permission, enable };
}

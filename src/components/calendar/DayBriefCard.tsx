import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, RefreshCw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDayBrief, type DayBrief } from "@/lib/day-brief.functions";
import { eventsOnDay, fmt } from "@/lib/calendar";
import type { EventRow } from "@/lib/categories";

const LABEL: Record<string, string> = {
  google: "Via din Google-nyckel",
  openai: "Via ChatGPT",
  perplexity: "Via Perplexity",
  lovable: "Via Lovable (reserv)",
};

export function DayBriefCard({ events, day }: { events: EventRow[]; day: Date }) {
  const fetchBrief = useServerFn(getDayBrief);
  const payload = useMemo(() => {
    const items = eventsOnDay(events, day).map((e) => ({
      title: e.title,
      start: e.all_day ? "heldag" : fmt(e.starts_at, "HH:mm"),
      end: e.all_day ? "" : fmt(e.ends_at, "HH:mm"),
      location: e.location ?? null,
      category: String(e.category ?? ""),
    }));
    return { date: fmt(day, "EEEE d MMMM yyyy"), events: items };
  }, [events, day]);
  const key = `daybrief:${fmt(day, "yyyy-MM-dd")}:${JSON.stringify(payload.events).length}:${payload.events.map((e) => e.start + e.title).join("|").slice(0, 300)}`;
  const [brief, setBrief] = useState<DayBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function load(force = false) {
    if (!force) {
      const cached = localStorage.getItem(key);
      if (cached) {
        setBrief(JSON.parse(cached));
        return;
      }
    }
    setLoading(true);
    setError(false);
    try {
      const r = await fetchBrief({ data: payload });
      setBrief(r);
      localStorage.setItem(key, JSON.stringify(r));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setBrief(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="card-soft mb-4 overflow-hidden p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          Din dag i korthet
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Uppdatera
        </Button>
      </div>
      {loading && !brief ? (
        <p className="text-sm text-muted-foreground">Andrea går igenom din dag…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">Kunde inte sammanfatta dagen just nu.</p>
      ) : brief ? (
        <div className="space-y-3 text-sm">
          <p className="leading-relaxed">{brief.summary}</p>
          <Section icon={<Target className="size-3.5" />} title="Viktigast" items={brief.priorities} />
          <Section icon={<Clock className="size-3.5" />} title="Luckor" items={brief.gaps} />
          <Section icon={<AlertTriangle className="size-3.5" />} title="Tänk på" items={brief.warnings} warn />
          <p className="text-[11px] text-muted-foreground/70">{LABEL[brief.provider] ?? ""}</p>
        </div>
      ) : null}
    </div>
  );
}

function Section({ icon, title, items, warn }: { icon: React.ReactNode; title: string; items: string[]; warn?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <div className={`mb-1 flex items-center gap-1.5 text-xs font-medium ${warn ? "text-destructive" : "text-muted-foreground"}`}>
        {icon}
        {title}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <li key={i} className={`rounded-full px-2.5 py-1 text-xs ${warn ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

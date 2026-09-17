/** Mätbara siffror för verksamheten – delas av personal- och brukarvyn. */
export type CareStat = {
  visits: number;
  done: number;
  missed: number;
  planned: number;
  minutes: number;
  meters: number;
  deviations: number;
};

export const emptyStat: CareStat = {
  visits: 0,
  done: 0,
  missed: 0,
  planned: 0,
  minutes: 0,
  meters: 0,
  deviations: 0,
};

export function hours(minutes: number): string {
  return (minutes / 60).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}

export function km(meters: number): string {
  return (meters / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}

export function donePercent(s: CareStat): number {
  const closed = s.done + s.missed;
  return closed === 0 ? 0 : Math.round((s.done / closed) * 100);
}

/** Kort rad med nyckeltal, t.ex. under en lista. */
export function StatLine({ stat }: { stat: CareStat }) {
  return (
    <p className="text-sm text-muted-foreground">
      {stat.visits} besök · {hours(stat.minutes)} h · {km(stat.meters)} km ·{" "}
      {donePercent(stat)} % utförda
      {stat.deviations > 0 ? ` · ${stat.deviations} avvikelser` : ""}
    </p>
  );
}

/** Rutnät med nyckeltal högst upp i en vy. */
export function StatGrid({
  stat,
  days,
  extra,
}: {
  stat: CareStat;
  days: number;
  extra?: { label: string; value: string }[];
}) {
  const items = [
    { label: `Besök ${days} dagar`, value: String(stat.visits) },
    { label: "Utförda", value: `${stat.done} (${donePercent(stat)} %)` },
    { label: "Planerade", value: String(stat.planned) },
    { label: "Insatstid", value: `${hours(stat.minutes)} h` },
    { label: "Restid/sträcka", value: `${km(stat.meters)} km` },
    { label: "Avvikelser", value: String(stat.deviations) },
    ...(extra ?? []),
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border border-border/70 bg-card p-3">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="font-display text-xl font-semibold">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

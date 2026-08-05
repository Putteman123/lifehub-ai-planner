import { SHIFT_STYLES } from "@/lib/categories";

/** Förklaring av pass- och beläggningsfärger, används bl.a. i årsvyn. */
export function ShiftLegend({ showLoad = false }: { showLoad?: boolean }) {
  const items = [
    { label: "Nattpass (21.30–07)", dot: SHIFT_STYLES.natt.dot },
    { label: "Kvällspass", dot: SHIFT_STYLES.kvall.dot },
  ];
  const loadItems = [
    { label: "Ledig", dot: "bg-surface border border-border" },
    { label: "Delvis upptagen", dot: "bg-cat-barn/40" },
    { label: "Fullbokad", dot: "bg-cat-viktigt/40" },
  ];
  return (
    <div className="card-soft flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">Färgförklaring</span>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${i.dot}`} />
          {i.label}
        </span>
      ))}
      {showLoad
        ? loadItems.map((i) => (
            <span key={i.label} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[3px] ${i.dot}`} />
              {i.label}
            </span>
          ))
        : null}
    </div>
  );
}

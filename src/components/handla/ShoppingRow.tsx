import { Check, Sparkles, Trash2 } from "lucide-react";

import type { ShoppingItem } from "@/lib/shopping";

/** En rad i inköpslistan. I handlingsläge är hela raden en stor tryckyta. */
export function ShoppingRow({
  item,
  shopping,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  shopping: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div
        className={`flex items-center gap-2 rounded-2xl border transition-all duration-300 ${
          item.is_checked
            ? "border-cat-ledig/40 bg-cat-ledig/10 opacity-70"
            : "border-border bg-card"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={item.is_checked}
          className={`flex flex-1 items-center gap-3 rounded-2xl px-4 text-left transition-transform active:scale-[0.98] ${
            shopping ? "min-h-16 py-3" : "min-h-12 py-2"
          }`}
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              shopping ? "size-9" : "size-6"
            } ${
              item.is_checked
                ? "border-cat-ledig bg-cat-ledig text-white"
                : "border-muted-foreground/30 text-transparent"
            }`}
          >
            <Check className={shopping ? "size-5" : "size-3.5"} />
          </span>
          <span
            className={`min-w-0 flex-1 truncate font-medium ${
              shopping ? "text-lg" : "text-sm"
            } ${item.is_checked ? "text-muted-foreground line-through" : ""}`}
          >
            {item.name}
          </span>
          {item.source === "ai" ? (
            <Sparkles className="size-4 shrink-0 text-primary" aria-label="Förslag från Andrea" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Ta bort ${item.name}`}
          className={`mr-2 flex shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${
            shopping ? "size-12" : "size-9"
          }`}
        >
          <Trash2 className={shopping ? "size-5" : "size-4"} />
        </button>
      </div>
    </li>
  );
}

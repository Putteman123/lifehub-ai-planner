import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES, paletteByToken, type CustomCategoryRow } from "@/lib/categories";
import {
  useCreateCategory,
  useCustomCategories,
  useDeleteCategory,
  useRenameCategory,
} from "@/lib/event-categories";

/** Hantera egna kategorier: skapa, döp om och ta bort. */
export function CategoryManager() {
  const { data: custom = [] } = useCustomCategories();
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  function startEdit(row: CustomCategoryRow) {
    setEditingId(row.id);
    setEditLabel(row.label);
  }

  return (
    <section className="card-soft p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Tag className="size-4" /> Kategorier
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Egna kategorier dyker upp i alla kategorilistor i appen.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <span key={c.value} className={`rounded-full px-2.5 py-1 text-[11px] ${c.chip}`}>
            {c.label}
          </span>
        ))}
      </div>

      {custom.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {custom.map((row) => {
            const palette = paletteByToken(row.color_token);
            return (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${palette.dot}`} />
                {editingId === row.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editLabel}
                      maxLength={40}
                      className="h-8"
                      onChange={(e) => setEditLabel(e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Spara namn"
                      onClick={() =>
                        rename.mutate(
                          { id: row.id, label: editLabel },
                          { onSuccess: () => setEditingId(null) },
                        )
                      }
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Avbryt"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm">{row.label}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Byt namn"
                      onClick={() => startEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      aria-label="Ta bort kategori"
                      onClick={() => {
                        if (confirm(`Ta bort "${row.label}"? Händelser flyttas till Privat.`)) {
                          remove.mutate(row);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={newLabel}
          maxLength={40}
          placeholder="Ny kategori, t.ex. Träning"
          className="h-9"
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create.mutate(newLabel, { onSuccess: () => setNewLabel("") });
            }
          }}
        />
        <Button
          size="sm"
          disabled={create.isPending || !newLabel.trim()}
          onClick={() => create.mutate(newLabel, { onSuccess: () => setNewLabel("") })}
        >
          <Plus className="size-4" /> Lägg till
        </Button>
      </div>
    </section>
  );
}

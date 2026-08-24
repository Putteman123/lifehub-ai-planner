import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Loader2, Plus, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { DoneOverlay } from "@/components/handla/DoneOverlay";
import { PantryTopCard } from "@/components/handla/PantryTopCard";
import { PriceBookCard } from "@/components/handla/PriceBookCard";
import { ShoppingRow } from "@/components/handla/ShoppingRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  daysSincePurchase,
  nameKey,

  useActiveList,
  useAddItems,
  useDeleteItem,
  useDeletePantryItem,
  usePantry,
  useShoppingItems,
  useShoppingRealtime,
  useToggleItem,
} from "@/lib/shopping";
import { completeShoppingList, suggestShoppingItems } from "@/lib/shopping.functions";

export const Route = createFileRoute("/_authenticated/handla")({
  head: () => ({
    meta: [
      { title: "Handla – LifeHub AI" },
      {
        name: "description",
        content:
          "Inköpslista för dagligvaror med stora avbockningsknappar, AI-förslag och minne av dina vanligaste varor.",
      },
      { property: "og:title", content: "Handla – LifeHub AI" },
      {
        property: "og:description",
        content: "Fyll på listan löpande och bocka av varorna medan du handlar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShoppingPage,
});

function ShoppingPage() {
  const qc = useQueryClient();
  const listQ = useActiveList();
  const listId = listQ.data?.id;
  const itemsQ = useShoppingItems(listId);
  const pantryQ = usePantry();
  useShoppingRealtime(listId);


  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const addItems = useAddItems(listId);
  const toggleItem = useToggleItem(listId);
  const deleteItem = useDeleteItem(listId);
  const deletePantry = useDeletePantryItem();

  const suggest = useServerFn(suggestShoppingItems);
  const complete = useServerFn(completeShoppingList);

  const [draft, setDraft] = useState("");
  const [shopping, setShopping] = useState(false);
  const [doneText, setDoneText] = useState<string | null>(null);

  const checked = items.filter((item) => item.is_checked);
  const open = items.filter((item) => !item.is_checked);
  const progress = items.length ? Math.round((checked.length / items.length) * 100) : 0;

  const inList = new Set(items.map((item) => nameKey(item.name)));
  const frequent = (pantryQ.data ?? []).filter((row) => !inList.has(row.name_key)).slice(0, 12);

  const enrich = useMutation({
    mutationFn: async () => {
      const res = await suggest({ data: { existing: items.map((item) => item.name) } });
      const names = res.items.map((item) => item.name);
      if (!names.length) throw new Error("Andrea hittade inga nya varor att föreslå.");
      await addItems.mutateAsync({ names, source: "ai" });
      return names.length;
    },
    onSuccess: (count) => toast.success(`Andrea la till ${count} varor`),
    onError: (error: Error) => toast.error(error.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!listId) throw new Error("Ingen aktiv lista.");
      return complete({ data: { listId } });
    },
    onSuccess: (res) => {
      setShopping(false);
      setDoneText(res.title);
      qc.invalidateQueries({ queryKey: ["shopping_list", "aktiv"] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addDraft() {
    const names = draft
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!names.length) return;
    addItems.mutate({ names });
    setDraft("");
  }

  return (
    <AppShell
      title="Handla"
      subtitle="Inköpslista för dagligvaror"
      actions={
        <Button
          size="sm"
          variant={shopping ? "default" : "outline"}
          onClick={() => setShopping((v) => !v)}
        >
          <ShoppingCart className="size-4" />
          {shopping ? "Butiksläge på" : "Butiksläge"}
        </Button>
      }
    >
      <DataGate queries={[listQ, itemsQ, pantryQ]}>
        <div className="mx-auto max-w-2xl space-y-4">
          <section className="card-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {checked.length} av {items.length} nedplockade
                </p>
                <p className="text-xs text-muted-foreground">
                  {open.length ? `${open.length} kvar i butiken` : "Allt är nedplockat"}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!items.length || finish.isPending}
                onClick={() => finish.mutate()}
              >
                {finish.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCheck className="size-4" />
                )}
                Klar
              </Button>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-cat-ledig transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>

          <section className="card-soft space-y-3 p-4">
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
                placeholder="Lägg till vara…"
                aria-label="Lägg till vara"
                className="h-12 text-base"
              />
              <Button className="h-12 px-4" onClick={addDraft} disabled={addItems.isPending}>
                <Plus className="size-5" />
              </Button>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => enrich.mutate()}
              disabled={enrich.isPending}
            >
              {enrich.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-primary" />
              )}
              Förgyll med Andrea
            </Button>

            {frequent.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Skafferiet – tryck på en vara för att lägga den i listan
                </p>
                <div className="flex flex-wrap gap-2">
                  {frequent.map((row) => {
                    const days = daysSincePurchase(row);
                    return (
                      <span
                        key={row.id}
                        className="flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 text-sm"
                      >
                        <button
                          type="button"
                          className="flex items-center gap-2 py-1.5"
                          onClick={() => addItems.mutate({ names: [row.name] })}
                        >
                          {row.name}
                          <span className="text-[11px] text-muted-foreground">
                            {days === null
                              ? "ej köpt"
                              : days === 0
                                ? "idag"
                                : `${days} d sedan`}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Glöm ${row.name}`}
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deletePantry.mutate(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <PantryTopCard
            pantry={pantryQ.data ?? []}
            onPick={(name) => addItems.mutate({ names: [name] })}
          />

          <PriceBookCard />

          {items.length === 0 ? (
            <div className="card-soft p-8 text-center">
              <ShoppingCart className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Listan är tom</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Skriv in varor löpande eller låt Andrea förgylla listan.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {open.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    shopping={shopping}
                    onToggle={() => toggleItem.mutate(item)}
                    onDelete={() => deleteItem.mutate(item.id)}
                  />
                ))}
              </ul>

              {checked.length ? (
                <section>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    I påsen ({checked.length})
                  </p>
                  <ul className="space-y-2">
                    {checked.map((item) => (
                      <ShoppingRow
                        key={item.id}
                        item={item}
                        shopping={shopping}
                        onToggle={() => toggleItem.mutate(item)}
                        onDelete={() => deleteItem.mutate(item.id)}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </DataGate>

      {doneText ? <DoneOverlay text={doneText} onDone={() => setDoneText(null)} /> : null}
    </AppShell>
  );
}

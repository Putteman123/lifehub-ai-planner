import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CareSectionHeader } from "@/components/care/CareUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addShoppingItem,
  listShopping,
  removeShoppingItem,
  setShoppingDone,
  type ShoppingItem,
} from "@/lib/care-shopping.functions";
import { useDemoRole } from "@/lib/demo-role";

export const Route = createFileRoute("/_authenticated/v/f/$slug/handla")({
  head: () => ({
    meta: [
      { title: "Handla – Alfa 1.0 Vård" },
      {
        name: "description",
        content: "Inköpslista per brukare: personal, brukare och anhöriga håller listan aktuell.",
      },
      { property: "og:title", content: "Handla – Alfa 1.0 Vård" },
      {
        property: "og:description",
        content: "Inköpslista per brukare i hemtjänsten – lägg till, bocka av och notera belopp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShoppingPage,
});

function ShoppingPage() {
  const { slug } = Route.useParams();
  const { role } = useDemoRole();
  const qc = useQueryClient();

  const fetchList = useServerFn(listShopping);
  const addItem = useServerFn(addShoppingItem);
  const toggle = useServerFn(setShoppingDone);
  const remove = useServerFn(removeShoppingItem);

  const [clientId, setClientId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("");

  const q = useQuery({
    queryKey: ["care-shopping", slug],
    queryFn: () => fetchList({ data: { slug } }),
  });

  const clients = q.data?.clients ?? [];
  const limited = role === "client" || role === "relative";
  const visibleClients = limited ? clients.slice(0, 1) : clients;
  const current = visibleClients.find((c) => c.id === clientId) ?? visibleClients[0];
  const items = useMemo(
    () => ((q.data?.items ?? []) as ShoppingItem[]).filter((i) => i.client_id === current?.id),
    [q.data, current?.id],
  );

  const refresh = () => void qc.invalidateQueries({ queryKey: ["care-shopping", slug] });

  const create = useMutation({
    mutationFn: () =>
      addItem({
        data: { slug, clientId: current!.id, title: title.trim(), quantity: quantity.trim() },
      }),
    onSuccess: () => {
      setTitle("");
      setQuantity("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDone = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggle({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const open = items.filter((i) => !i.is_done);
  const done = items.filter((i) => i.is_done);
  const spent = done.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <CareSectionHeader
        icon={<ShoppingCart className="h-5 w-5" aria-hidden />}
        title="Handla"
        subtitle="Inköpslista per brukare. Anhöriga kan önska, personal bockar av när varan är köpt."
      />

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar inköpslistor…</p>
      ) : visibleClients.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
          Det finns inga brukare att handla åt ännu.
        </p>
      ) : (
        <>
          {visibleClients.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {visibleClients.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={c.id === current?.id ? "default" : "outline"}
                  onClick={() => setClientId(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Kvar att handla" value={`${open.length} varor`} />
            <Stat label="Köpt" value={`${done.length} varor`} />
            <Stat label="Summa inköp" value={`${Math.round(spent)} kr`} />
          </div>

          <form
            className="flex flex-wrap items-end gap-2 rounded-3xl border border-border/70 bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim().length === 0 || !current) return;
              create.mutate();
            }}
          >
            <div className="min-w-48 flex-1">
              <label className="text-xs text-muted-foreground" htmlFor="vara">
                Vara
              </label>
              <Input
                id="vara"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. mjölk"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground" htmlFor="antal">
                Antal
              </label>
              <Input
                id="antal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="2 st"
              />
            </div>
            <Button type="submit" className="gap-2" disabled={create.isPending}>
              <Plus className="h-4 w-4" aria-hidden />
              Lägg till
            </Button>
          </form>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Att handla</h2>
            {open.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Listan är tom – lägg till det som behöver köpas.
              </p>
            ) : (
              open.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onDone={() => setDone.mutate({ id: item.id, done: true })}
                  onRemove={() => drop.mutate(item.id)}
                />
              ))
            )}
          </section>

          {done.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Köpt</h2>
              {done.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onUndo={() => setDone.mutate({ id: item.id, done: false })}
                  onRemove={() => drop.mutate(item.id)}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Row({
  item,
  onDone,
  onUndo,
  onRemove,
}: {
  item: ShoppingItem;
  onDone?: () => void;
  onUndo?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {item.title}
          {item.quantity ? <span className="text-muted-foreground"> · {item.quantity}</span> : null}
        </span>
        <span className="block text-xs text-muted-foreground">
          {item.created_name ? `Tillagd av ${item.created_name}` : "Tillagd"}
          {item.created_role ? ` (${item.created_role})` : ""}
        </span>
      </span>
      {onDone ? (
        <Button size="sm" className="gap-2" onClick={onDone}>
          <Check className="h-4 w-4" aria-hidden />
          Köpt
        </Button>
      ) : null}
      {onUndo ? (
        <Button size="sm" variant="outline" className="gap-2" onClick={onUndo}>
          <Undo2 className="h-4 w-4" aria-hidden />
          Ångra
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Ta bort">
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

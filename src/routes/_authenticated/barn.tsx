import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ChildWeekCards } from "@/components/barn/ChildWeekCards";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { categoryMeta, type EventRow } from "@/lib/categories";
import { addDays, eventsOnDay, fmt, mergeDuplicates, timeRange } from "@/lib/calendar";
import { useChildren, useEvents, useUpsertRow } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/barn")({
  head: () => ({
    meta: [
      { title: "Barn – LifeHub AI" },
      { name: "description", content: "Träningar, matcher, skola, lov och läkarbesök samlat." },
      { property: "og:title", content: "Barn – LifeHub AI" },
      { property: "og:description", content: "Överblick över barnens schema och tid hos dig." },
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const childrenQ = useChildren();
  const children = childrenQ.data ?? [];
  const eventsQ = useEvents();
  const rawEvents = eventsQ.data ?? [];
  const upsertChild = useUpsertRow("children");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const events = useMemo(
    () =>
      mergeDuplicates(rawEvents).filter(
        (e) => e.category === "barn" && (!filter || e.child_id === filter),
      ),
    [rawEvents, filter],
  );

  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  const upcoming = days
    .map((d) => ({ day: d, items: eventsOnDay(events, d) }))
    .filter((d) => d.items.length > 0);
  const totalActivities = upcoming.reduce((sum, d) => sum + d.items.length, 0);

  async function saveChild() {
    if (!name.trim()) return;
    await upsertChild.mutateAsync({ name: name.trim(), birth_date: birth || null });
    setName("");
    setBirth("");
    setAddOpen(false);
  }

  return (
    <AppShell
      title="Barn"
      subtitle="Träningar, matcher, skola och läkarbesök"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Barn
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setEventOpen(true);
            }}
          >
            <Plus className="size-4" /> Aktivitet
          </Button>
        </div>
      }
    >
      <DataGate queries={[childrenQ, eventsQ]}>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full border px-3 py-1 text-xs ${
            filter === null ? "border-transparent bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          Alla
        </button>
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === c.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {children.length === 0 ? (
        <div className="card-soft mt-5 p-6 text-sm text-muted-foreground">
          Lägg till dina barn för att se deras scheman samlat.
        </div>
      ) : null}

      {children.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="card-soft p-4">
            <p className="text-xs text-muted-foreground">Aktiviteter (14 dagar)</p>
            <p className="text-2xl font-semibold">{totalActivities}</p>
          </div>
          <div className="card-soft p-4">
            <p className="text-xs text-muted-foreground">Barn</p>
            <p className="text-2xl font-semibold">{children.length}</p>
          </div>
          <div className="card-soft p-4">
            <p className="text-xs text-muted-foreground">Dagar med aktiviteter</p>
            <p className="text-2xl font-semibold">{upcoming.length}</p>
          </div>
        </div>
      ) : null}

      <ChildWeekCards children={children} events={events} />

      <div className="mt-5 space-y-4">
        {upcoming.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground">
            Inga barnaktiviteter de kommande två veckorna.
          </div>
        ) : (
          upcoming.map(({ day, items }) => (
            <section key={day.toISOString()} className="card-soft p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {fmt(day, "EEEE d MMMM")}
              </h3>
              <div className="mt-3 space-y-2">
                {items.map((e) => {
                  const child = children.find((c) => c.id === e.child_id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelected(e);
                        setEventOpen(true);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border-l-2 bg-surface px-3 py-2 text-left hover:bg-accent ${categoryMeta("barn").bar}`}
                    >
                      <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {timeRange(e)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
                      {child ? (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px]">
                          {child.name}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till barn</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="child-name">Namn</Label>
              <Input id="child-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="child-birth">Födelsedatum</Label>
              <Input
                id="child-birth"
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveChild}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        event={selected}
        defaultDate={new Date()}
        defaultCategory="barn"
      />
      </DataGate>
    </AppShell>
  );
}

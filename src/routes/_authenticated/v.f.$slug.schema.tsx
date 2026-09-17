import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSchedule, removeVisit, saveVisit } from "@/lib/care-admin.functions";

export const Route = createFileRoute("/_authenticated/v/f/$slug/schema")({
  head: () => ({
    meta: [
      { title: "Schema – LifeHub Vård" },
      { name: "description", content: "Veckans besök per brukare och personal." },
      { property: "og:title", content: "Schema – LifeHub Vård" },
      { property: "og:description", content: "Veckans besök per brukare och personal." },
    ],
  }),
  component: SchedulePage,
});

function mondayOf(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
const UNASSIGNED = "__none__";

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SchedulePage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const fetchSchedule = useServerFn(listSchedule);
  const persistVisit = useServerFn(saveVisit);
  const deleteVisit = useServerFn(removeVisit);

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  const q = useQuery({
    queryKey: ["care-schedule", slug, weekStart.toISOString()],
    queryFn: () =>
      fetchSchedule({
        data: { slug, from: weekStart.toISOString(), to: weekEnd.toISOString() },
      }),
  });

  const [form, setForm] = useState(() => {
    const start = new Date(weekStart);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    return {
      clientId: "",
      staffId: UNASSIGNED,
      title: "",
      starts_at: localInput(start),
      ends_at: localInput(end),
    };
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["care-schedule", slug] });

  const create = useMutation({
    mutationFn: () =>
      persistVisit({
        data: {
          slug,
          clientId: form.clientId,
          staffId: form.staffId === UNASSIGNED ? null : form.staffId,
          title: form.title || undefined,
          starts_at: form.starts_at,
          ends_at: form.ends_at,
        },
      }),
    onSuccess: () => {
      toast.success("Besöket är inlagt.");
      setForm({ ...form, title: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVisit({ data: { slug, id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Hämtar…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const clients = (q.data?.clients ?? []) as { id: string; name: string }[];
  const staff = (q.data?.staff ?? []) as { id: string; display_name: string }[];
  const visits = (q.data?.visits ?? []) as {
    id: string;
    title: string | null;
    starts_at: string;
    ends_at: string;
    client_id: string;
    staff_id: string | null;
  }[];

  const nameOfClient = (id: string) => clients.find((c) => c.id === id)?.name ?? "Brukare";
  const nameOfStaff = (id: string | null) =>
    id ? (staff.find((s) => s.id === id)?.display_name ?? "Personal") : null;

  const overlapping = new Set<string>();
  for (const a of visits) {
    for (const b of visits) {
      if (a.id === b.id || !a.staff_id || a.staff_id !== b.staff_id) continue;
      if (new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at)) {
        overlapping.add(a.id);
      }
    }
  }

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Schema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vecka från{" "}
            {weekStart.toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => shiftWeek(-1)}>
          Föregående
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
          Denna vecka
        </Button>
        <Button variant="secondary" size="sm" onClick={() => shiftWeek(1)}>
          Nästa
        </Button>
      </header>

      <div className="rounded-3xl border border-border/70 bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Nytt besök</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Brukare</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Välj brukare" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Personal</Label>
            <Select value={form.staffId} onValueChange={(v) => setForm({ ...form, staffId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Obemannat</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slut</Label>
            <Input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Rubrik</Label>
            <Input
              placeholder="T.ex. Morgonbesök"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
        </div>
        <Button
          className="mt-3"
          disabled={!form.clientId || create.isPending}
          onClick={() => create.mutate()}
        >
          Lägg till besök
        </Button>
        {clients.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Lägg upp en brukare först under Personal & brukare.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {DAYS.map((day, i) => {
          const dayStart = new Date(weekStart);
          dayStart.setDate(dayStart.getDate() + i);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          const dayVisits = visits.filter((v) => {
            const s = new Date(v.starts_at);
            return s >= dayStart && s < dayEnd;
          });
          return (
            <div key={day} className="rounded-3xl border border-border/70 bg-card p-4">
              <p className="font-display font-semibold">
                {day}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {dayStart.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                </span>
              </p>
              {dayVisits.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Inga besök.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {dayVisits.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {new Date(v.starts_at).toLocaleTimeString("sv-SE", { timeStyle: "short" })}
                          {"–"}
                          {new Date(v.ends_at).toLocaleTimeString("sv-SE", { timeStyle: "short" })}{" "}
                          {nameOfClient(v.client_id)}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {v.title ? `${v.title} · ` : ""}
                          {nameOfStaff(v.staff_id) ?? "Obemannat besök"}
                          {overlapping.has(v.id) ? " · krockar med annat besök" : ""}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => del.mutate(v.id)}>
                        Ta bort
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

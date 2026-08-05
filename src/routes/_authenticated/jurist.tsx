import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Check, Briefcase, CalendarDays, ListTodo } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { EventDialog } from "@/components/EventDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { categoryMeta, type EventRow } from "@/lib/categories";
import { fmt, mergeDuplicates } from "@/lib/calendar";
import { useCaseTasks, useEvents, useCases, useUpsertRow } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/jurist")({
  head: () => ({
    meta: [
      { title: "Jurist – LifeHub AI" },
      { name: "description", content: "Klientmöten, domstolar, tidsfrister, uppgifter och anteckningar." },
      { property: "og:title", content: "Jurist – LifeHub AI" },
      { property: "og:description", content: "Separat arbetsyta för dina juristuppdrag." },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  const casesQ = useCases();
  const cases = casesQ.data ?? [];
  const tasksQ = useCaseTasks();
  const tasks = tasksQ.data ?? [];
  const eventsQ = useEvents();
  const rawEvents = eventsQ.data ?? [];
  const upsertCase = useUpsertRow("legal_cases");
  const upsertTask = useUpsertRow("case_tasks");

  const [caseOpen, setCaseOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [activeCase, setActiveCase] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [notes, setNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const events = useMemo(
    () => mergeDuplicates(rawEvents).filter((e) => e.category === "jurist"),
    [rawEvents],
  );
  const shownTasks = activeCase ? tasks.filter((t) => t.case_id === activeCase) : tasks;

  async function saveCase() {
    if (!title.trim()) return;
    await upsertCase.mutateAsync({
      title: title.trim(),
      client_name: client || null,
      description: notes || null,
    });
    setTitle("");
    setClient("");
    setNotes("");
    setCaseOpen(false);
  }

  async function saveTask() {
    if (!taskTitle.trim()) return;
    await upsertTask.mutateAsync({
      title: taskTitle.trim(),
      due_date: taskDue || null,
      case_id: activeCase,
    });
    setTaskTitle("");
    setTaskDue("");
    setTaskOpen(false);
  }

  return (
    <AppShell
      title="Jurist"
      subtitle="Klienter, förhandlingar och tidsfrister"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCaseOpen(true)}>
            <Plus className="size-4" /> Ärende
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedEvent(null);
              setEventOpen(true);
            }}
          >
            <Plus className="size-4" /> Möte
          </Button>
        </div>
      }
    >
      <DataGate queries={[casesQ, tasksQ, eventsQ]}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-soft flex items-center gap-3 p-4">
          <Briefcase className="size-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Ärenden</p>
            <p className="text-xl font-semibold">{cases.length}</p>
          </div>
        </div>
        <div className="card-soft flex items-center gap-3 p-4">
          <ListTodo className="size-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Öppna uppgifter</p>
            <p className="text-xl font-semibold">{tasks.filter((t) => !t.is_done).length}</p>
          </div>
        </div>
        <div className="card-soft flex items-center gap-3 p-4">
          <CalendarDays className="size-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Kommande möten</p>
            <p className="text-xl font-semibold">{events.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold">Ärenden</h2>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => setActiveCase(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                activeCase === null ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              Alla ärenden
            </button>
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCase(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left ${
                  activeCase === c.id ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className="block truncate text-sm font-medium">{c.title}</span>
                {c.client_name ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.client_name}
                  </span>
                ) : null}
              </button>
            ))}
            {cases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga ärenden ännu.</p>
            ) : null}
          </div>
        </section>

        <section className="card-soft p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Att göra & tidsfrister</h2>
            <Button size="sm" variant="ghost" onClick={() => setTaskOpen(true)}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {shownTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga uppgifter.</p>
            ) : (
              shownTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <button
                    onClick={() => upsertTask.mutate({ id: t.id, is_done: !t.is_done })}
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      t.is_done ? "bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {t.is_done ? <Check className="size-3" /> : null}
                  </button>
                  <span className={`min-w-0 flex-1 truncate ${t.is_done ? "line-through opacity-60" : ""}`}>
                    {t.title}
                  </span>
                  {t.due_date ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmt(t.due_date, "d MMM")}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-soft p-5">
          <h2 className="text-sm font-semibold">Kommande möten & förhandlingar</h2>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga juristmöten inplanerade.</p>
            ) : (
              events.slice(0, 12).map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSelectedEvent(e);
                    setEventOpen(true);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-2 bg-surface px-3 py-2 text-left hover:bg-accent ${categoryMeta("jurist").bar}`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmt(e.starts_at, "d MMM HH:mm")}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {activeCase ? (
        <section className="card-soft mt-5 p-5">
          <h2 className="text-sm font-semibold">Anteckningar</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {cases.find((c) => c.id === activeCase)?.description || "Inga anteckningar."}
          </p>
        </section>
      ) : null}

      <Dialog open={caseOpen} onOpenChange={setCaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nytt ärende</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="case-title">Titel</Label>
              <Input id="case-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-client">Klient</Label>
              <Input id="case-client" value={client} onChange={(e) => setClient(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-desc">Anteckningar</Label>
              <Textarea id="case-desc" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveCase}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny uppgift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Titel</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Tidsfrist</Label>
              <Input
                id="task-due"
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveTask}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        event={selectedEvent}
        defaultDate={new Date()}
        defaultCategory="jurist"
      />
      </DataGate>
    </AppShell>
  );
}

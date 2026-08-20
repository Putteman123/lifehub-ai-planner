import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Archive, Check, ListTodo, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DataGate } from "@/components/DataGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TodoPlanCard } from "@/components/TodoPlanCard";
import { useDeleteRow, useTodos, useUpsertRow } from "@/lib/db";
import { dueLabel, dueTone, sortTodos, toLocalInput, type TodoRow } from "@/lib/todos";
import { parseFixedTodoMarker } from "@/lib/fixed-expenses";
import { setFixedPaid } from "@/lib/finance.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attgora")({
  head: () => ({
    meta: [
      { title: "Att göra – LifeHub AI" },
      {
        name: "description",
        content: "Samla dina uppgifter, sätt valfritt sista datum och arkivera det du blir klar med.",
      },
      { property: "og:title", content: "Att göra – LifeHub AI" },
      {
        property: "og:description",
        content: "Enkel uppgiftslista med valfria deadlines och automatiskt arkiv.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodoPage,
});

const TONE_CLASS: Record<string, string> = {
  overdue: "text-destructive",
  soon: "text-cat-viktigt",
  normal: "text-muted-foreground",
};

function TodoPage() {
  const todosQ = useTodos();
  const todos = todosQ.data ?? [];
  const upsert = useUpsertRow("todos", "Uppgift sparad");
  const qc = useQueryClient();
  const remove = useDeleteRow("todos", "Uppgift borttagen");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TodoRow | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const active = useMemo(() => sortTodos(todos.filter((t) => !t.is_done)), [todos]);
  const archived = useMemo(
    () =>
      todos
        .filter((t) => t.is_done)
        .sort((a, b) =>
          (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at),
        ),
    [todos],
  );

  function openNew() {
    setEditing(null);
    setTitle("");
    setNotes("");
    setDue("");
    setOpen(true);
  }

  function openEdit(todo: TodoRow) {
    setEditing(todo);
    setTitle(todo.title);
    setNotes(todo.notes ?? "");
    setDue(toLocalInput(todo.due_date));
    setOpen(true);
  }

  function save() {
    if (!title.trim()) return;
    upsert.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        title: title.trim(),
        notes: notes.trim() || null,
        due_date: due ? new Date(due).toISOString() : null,
        is_done: editing?.is_done ?? false,
        completed_at: editing?.completed_at ?? null,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  function toggle(todo: TodoRow) {
    // Restskulder från fasta utgifter bokförs som betalda i stället för klarmarkerade.
    const fixedRef = parseFixedTodoMarker(todo.notes);
    if (fixedRef && !todo.is_done) {
      void setFixedPaid({
        data: { expenseId: fixedRef.expenseId, period: fixedRef.period, paid: true },
      })
        .then(() => {
          void qc.invalidateQueries({ queryKey: ["todos"] });
          void qc.invalidateQueries({ queryKey: ["fixed_expense_payments"] });
          toast.success("Markerad som betald");
        })
        .catch((e: Error) => toast.error(e.message));
      return;
    }
    upsert.mutate({
      id: todo.id,
      title: todo.title,
      notes: todo.notes,
      due_date: todo.due_date,
      is_done: !todo.is_done,
      completed_at: todo.is_done ? null : new Date().toISOString(),
    });
  }

  return (
    <AppShell
      title="Att göra"
      subtitle="Uppgifter, valfria deadlines och arkiv"
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> Ny uppgift
        </Button>
      }
    >
      <DataGate queries={[todosQ]}>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ListTodo className="size-4" /> Aktiva
              </h2>
              <span className="text-xs text-muted-foreground">{active.length} st</span>
            </div>

            {active.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Inget att göra just nu. Lägg till din första uppgift.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {active.map((todo) => {
                  const label = dueLabel(todo.due_date);
                  const tone = dueTone(todo.due_date);
                  const overdueFixed = Boolean(parseFixedTodoMarker(todo.notes));
                  return (
                    <li
                      key={todo.id}
                      className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                        overdueFixed
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-border/70"
                      }`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={todo.is_done}
                        aria-label={`Markera "${todo.title}" som klar`}
                        onClick={() => toggle(todo)}
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-border bg-background text-transparent transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Check className="size-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            overdueFixed ? "text-destructive" : ""
                          }`}
                        >
                          {todo.title}
                        </p>
                        {todo.notes ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                            {todo.notes}
                          </p>
                        ) : null}
                        {label ? (
                          <p className={`mt-1 text-xs font-medium ${TONE_CLASS[tone]}`}>{label}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label="Redigera uppgift"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(todo)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Ta bort uppgift"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(todo.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <TodoPlanCard todos={active} />

          <section className="rounded-2xl border border-border bg-card p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setShowArchive((v) => !v)}
              aria-expanded={showArchive}
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Archive className="size-4" /> Arkiv
              </h2>
              <span className="text-xs text-muted-foreground">{archived.length} st</span>
            </button>

            {archived.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Avklarade uppgifter hamnar här automatiskt.
              </p>
            ) : (
              <ul className={`mt-3 space-y-2 ${showArchive ? "" : "max-h-64 overflow-hidden"}`}>
                {(showArchive ? archived : archived.slice(0, 5)).map((todo) => (
                  <li key={todo.id} className="group flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="true"
                      aria-label={`Återöppna "${todo.title}"`}
                      onClick={() => toggle(todo)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-primary bg-primary text-primary-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground line-through">
                      {todo.title}
                    </span>

                    <button
                      type="button"
                      aria-label="Återaktivera uppgift"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => toggle(todo)}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ta bort permanent"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(todo.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DataGate>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera uppgift" : "Ny uppgift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="todo-title">Vad ska göras?</Label>
              <Input
                id="todo-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. Skicka in yttrande"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="todo-notes">Anteckning (valfritt)</Label>
              <Textarea
                id="todo-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="todo-due">Sista datum (valfritt)</Label>
              <Input
                id="todo-due"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              {due ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setDue("")}
                >
                  Ta bort datumet
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lämna tomt om uppgiften inte har någon deadline.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={!title.trim() || upsert.isPending}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

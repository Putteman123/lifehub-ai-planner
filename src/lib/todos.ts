import type { Tables } from "@/integrations/supabase/types";

export type TodoRow = Tables<"todos">;

/** Sorterar aktiva uppgifter: närmaste sista datum först, utan datum sist. */
export function sortTodos(todos: TodoRow[]) {
  return [...todos].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

export type DueTone = "overdue" | "soon" | "normal";

export function dueTone(due: string | null, now = new Date()): DueTone {
  if (!due) return "normal";
  const d = new Date(due);
  if (d.getTime() < now.getTime()) return "overdue";
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 2);
  return d.getTime() <= soon.getTime() ? "soon" : "normal";
}

export function dueLabel(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  const withTime = time === "00:00" ? "" : ` ${time}`;
  if (sameDay(d, today)) return `Idag${withTime}`;
  if (sameDay(d, tomorrow)) return `Imorgon${withTime}`;
  return (
    d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) + withTime
  );
}

/** Datum till värdet ett <input type="datetime-local"> förväntar sig. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

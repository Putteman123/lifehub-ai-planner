import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { listVisitTasks, setVisitTaskDone } from "@/lib/care-admin.functions";
import { demoRoleLabel, useDemoRole } from "@/lib/demo-role";

type Task = {
  id: string;
  title: string;
  is_done: boolean;
  done_at: string | null;
  done_role: string | null;
};

function clock(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  });
}

/**
 * Insatserna för ett besök med en tydlig "Utförd"-knapp.
 * Knappen visas för alla roller och sparar vem som kvitterade och när.
 */
export function CareVisitTasks({ slug, visitId }: { slug: string; visitId: string }) {
  const qc = useQueryClient();
  const { role } = useDemoRole();
  const fetchTasks = useServerFn(listVisitTasks);
  const markDone = useServerFn(setVisitTaskDone);

  const q = useQuery({
    queryKey: ["care-visit-tasks", slug, visitId],
    queryFn: () => fetchTasks({ data: { slug, visitId } }),
  });

  const toggle = useMutation({
    mutationFn: (t: Task) =>
      markDone({ data: { slug, id: t.id, done: !t.is_done, role: demoRoleLabel(role) } }),
    onSuccess: (_r, t) => {
      toast.success(t.is_done ? "Ångrat." : "Markerad som utförd.");
      void qc.invalidateQueries({ queryKey: ["care-visit-tasks", slug, visitId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = (q.data ?? []) as Task[];
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Hämtar insatser…</p>;
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground">Inga insatser på det här besöket.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {tasks.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-xl bg-background/70 px-3 py-2"
        >
          <ListChecks className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${t.is_done ? "text-muted-foreground line-through" : ""}`}>
              {t.title}
            </p>
            {t.is_done && t.done_at ? (
              <p className="text-[11px] text-muted-foreground">
                Utförd {clock(t.done_at)}
                {t.done_role ? ` · ${t.done_role}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(t)}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${
              t.is_done
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            <Check className="size-4" />
            {t.is_done ? "Utförd" : "Markera utförd"}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default CareVisitTasks;

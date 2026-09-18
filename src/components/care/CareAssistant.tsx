import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Send, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { askCareAssistant } from "@/lib/care-assistant.functions";
import { startCareMeet } from "@/lib/care-messages.functions";
import { demoRoleLabel, useDemoRole } from "@/lib/demo-role";

const QUICK = [
  "När kommer nästa besök?",
  "Hur ser min dag ut?",
  "Vilka mediciner ska tas idag?",
  "Vad hände vid senaste besöket?",
];

/**
 * Andrea i vårddelen – svarar på frågor om besök, dag och mediciner
 * och kan starta ett videosamtal med kontoret.
 */
export function CareAssistant({ slug, clientId }: { slug: string; clientId?: string }) {
  const { role } = useDemoRole();
  const ask = useServerFn(askCareAssistant);
  const meet = useServerFn(startCareMeet);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const askM = useMutation({
    mutationFn: (q: string) =>
      ask({ data: { slug, clientId, question: q, role: demoRoleLabel(role) } }),
    onSuccess: (r) => setAnswer(r.answer),
    onError: (e: Error) => toast.error(e.message),
  });

  const meetM = useMutation({
    mutationFn: () => {
      if (!clientId) throw new Error("Välj en brukare först.");
      return meet({ data: { clientId } });
    },
    onSuccess: (r: { link?: string | null }) => {
      if (r?.link) window.open(r.link, "_blank", "noopener");
      else toast.success("Videosamtal skapat.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuestion(text);
    askM.mutate(text);
  }

  return (
    <section className="rounded-3xl border border-border/70 bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-base font-semibold">Fråga Andrea</h2>
          <p className="text-xs text-muted-foreground">Besök, dagens plan och mediciner.</p>
        </div>
        {clientId ? (
          <button
            type="button"
            onClick={() => meetM.mutate()}
            disabled={meetM.isPending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-medium text-secondary-foreground"
          >
            {meetM.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Video className="size-4" />
            )}
            Ring kontoret
          </button>
        ) : null}
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => submit(q)}
            className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Skriv din fråga…"
          className="min-h-10 flex-1 rounded-xl border border-border/70 bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={askM.isPending}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          {askM.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Fråga
        </button>
      </form>

      {answer ? (
        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-background/70 p-3 text-sm">{answer}</p>
      ) : null}
    </section>
  );
}

export default CareAssistant;

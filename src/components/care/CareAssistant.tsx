import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarCheck, CalendarClock, CalendarDays, HeartPulse, Loader2, PhoneCall, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { askCareAssistant } from "@/lib/care-assistant.functions";
import { startCareMeet } from "@/lib/care-messages.functions";
import { demoRoleLabel, useDemoRole } from "@/lib/demo-role";

const QUICK = [
  { label: "Nästa besök", question: "När kommer nästa besök?", icon: CalendarClock },
  { label: "Dagens schema", question: "Hur ser min dag ut med besök och mediciner?", icon: CalendarDays },
  {
    label: "Besök i kalender",
    question: "Vilka besök finns i min kalender de kommande sju dagarna?",
    icon: CalendarCheck,
  },
] as const;

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
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HeartPulse className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="font-display text-base font-semibold">Fråga Andrea</h2>
          <p className="text-xs text-muted-foreground">Besök, dagens plan och mediciner.</p>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {QUICK.map(({ label, question: quickQuestion, icon: Icon }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            onClick={() => submit(quickQuestion)}
            disabled={askM.isPending}
            className="h-auto min-h-16 whitespace-normal px-3 py-3 text-left"
          >
            <Icon className="size-5 text-primary" />
            <span className="leading-tight">{label}</span>
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => meetM.mutate()}
          disabled={!clientId || meetM.isPending}
          className="h-auto min-h-16 whitespace-normal px-3 py-3 text-left"
          title={clientId ? "Starta videosamtal med kontoret" : "Välj en brukare först"}
        >
          {meetM.isPending ? <Loader2 className="size-5 animate-spin" /> : <PhoneCall className="size-5 text-primary" />}
          <span className="leading-tight">Ring kontoret</span>
        </Button>
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
        <Button
          type="submit"
          disabled={askM.isPending}
          className="min-h-10 px-3"
        >
          {askM.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Fråga
        </Button>
      </form>

      {answer ? (
        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-background/70 p-3 text-sm">{answer}</p>
      ) : null}
    </section>
  );
}

export default CareAssistant;

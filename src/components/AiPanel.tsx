import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/ai.functions";

const SUGGESTIONS = [
  "Sammanfatta min dag",
  "När är jag ledig fyra timmar?",
  "Finns det några krockar i veckan?",
  "När är första lediga kvällen?",
  "Hjälp mig planera om morgondagen",
];

export function AiPanel({ compact = false }: { compact?: boolean }) {
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await ask({ data: { question: q } });
      return res.answer;
    },
  });

  function run(q: string) {
    const value = q.trim();
    if (!value) return;
    setAsked(value);
    setQuestion("");
    mutation.mutate(value);
  }

  return (
    <section className="card-soft overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">AI-assistent</p>
          {!compact ? (
            <p className="text-xs text-muted-foreground">Fråga om din tid, dina luckor och krockar</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(question);
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Fråga AI om din kalender…"
            aria-label="Fråga AI"
          />
          <Button type="submit" disabled={mutation.isPending || !question.trim()}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Fråga"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.slice(0, compact ? 3 : SUGGESTIONS.length).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => run(s)}
              disabled={mutation.isPending}
              className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {asked ? (
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">{asked}</p>
            <div className="mt-2 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:space-y-1">
              {mutation.isPending ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Tänker…
                </span>
              ) : mutation.isError ? (
                <span className="text-destructive">
                  {mutation.error instanceof Error ? mutation.error.message : "Något gick fel."}
                </span>
              ) : (
                <ReactMarkdown>{mutation.data}</ReactMarkdown>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </section>
  );
}

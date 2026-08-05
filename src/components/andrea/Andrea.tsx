import { useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowRight, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "andrea_lifehub_v1";

const SUGGESTIONS = [
  "Sammanfatta min dag",
  "När är jag ledig fyra timmar?",
  "Finns det några krockar i veckan?",
  "Hjälp mig planera om morgondagen",
];

function loadHistory(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function Andrea() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Öppna Andrea"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.03] md:bottom-6 md:right-6"
        >
          <Sparkles className="size-4" />
          Andrea
        </button>
      ) : null}
      {open ? <AndreaPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AndreaPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ).current;

  const initial = useRef(loadHistory()).current;
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: "andrea-lifehub",
    messages: initial,
    transport,
  });

  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) taRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        /* ignore */
      }
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput("");
    sendMessage({ text: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-[2px]">
      <button className="flex-1" aria-label="Stäng" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Andrea</p>
              <p className="text-[11px] text-muted-foreground">Din AI-guide</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem(STORAGE_KEY);
                }}
              >
                Rensa
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Stäng Andrea">
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="card-soft p-4">
                <p className="text-sm font-medium">Hej! Jag håller koll på din tid.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fråga om dagen, luckor, krockar eller be mig öppna en vy.
                </p>
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primary/40"
                  >
                    <span>{s}</span>
                    <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => {
            const text = m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("");
            const gotos = m.parts.filter(
              (p) =>
                (p as { type: string; state?: string }).type === "tool-goto" &&
                (p as { state?: string }).state === "output-available",
            ) as unknown as { output?: { route?: string; reason?: string } }[];

            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {text}
                  </p>
                </div>
              );
            }
            return (
              <div key={m.id} className="max-w-[92%] space-y-2">
                <div className="rounded-2xl rounded-bl-sm bg-muted/50 px-3 py-2 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:space-y-1">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
                {gotos.map((g, i) =>
                  g.output?.route ? (
                    <button
                      key={i}
                      onClick={() => {
                        navigate({ to: g.output!.route as never });
                        onClose();
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      Öppna {g.output.route}
                      <ArrowRight className="size-3" />
                    </button>
                  ) : null,
                )}
              </div>
            );
          })}

          {status === "submitted" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Andrea tänker…
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error.message.includes("402")
                ? "AI-krediterna är slut. Fyll på i arbetsytans inställningar."
                : error.message.includes("429")
                  ? "AI:n är överbelastad just nu – försök igen strax."
                  : "Något gick fel. Försök igen."}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Fråga Andrea…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

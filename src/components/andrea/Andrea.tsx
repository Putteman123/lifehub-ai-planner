import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";

import {
  ArrowRight,
  Loader2,
  Mic,
  MicOff,

  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import andreaAvatar from "@/assets/andrea-avatar.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/lib/voice";

const STORAGE_KEY = "andrea_lifehub_v1";

const SUGGESTIONS = [
  "Sammanfatta min dag",
  "När kan jag träna 90 min?",
  "Finns det krockar i veckan?",
  "Hjälp mig planera om morgondagen",
  "Vad har barnen denna vecka?",
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

function textOf(m: UIMessage) {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

export function Andrea() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Öppna Andrea"
          title="Öppna Andrea – din AI-guide"
          className="fixed right-4 z-40 flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 sm:right-6"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <span className="pointer-events-none absolute inset-[-5px] rounded-full bg-primary/25 blur-md" />
          <span className="relative block size-14 sm:size-16">
            <img
              src={andreaAvatar}
              alt="Andrea"
              className="size-full rounded-full object-cover shadow-xl ring-2 ring-primary/50"
            />
            <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-background bg-cat-ledig" />
          </span>
          <span
            className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-primary/15"
            style={{ animationDuration: "4s" }}
          />
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
  const queryClient = useQueryClient();
  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    stop,
    addToolApprovalResponse,
  } = useChat({
    id: "andrea-lifehub",
    messages: initial,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      void queryClient.invalidateQueries();
    },
  });


  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput("");
    sendMessage({ text: value });
  }

  const voice = useVoice((text) => submit(text));
  const spokenRef = useRef<string | null>(null);

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

  // Läs upp Andreas senaste svar när uppläsning är på.
  useEffect(() => {
    if (!voice.ttsEnabled || isLoading) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const text = textOf(last);
    if (!text || spokenRef.current === last.id) return;
    spokenRef.current = last.id;
    voice.speak(text);
  }, [messages, isLoading, voice]);

  const statusLabel = isLoading
    ? "Tänker…"
    : voice.listening
      ? "Lyssnar…"
      : voice.speaking
        ? "Talar…"
        : "Din AI-guide";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-[2px]">
      <button className="hidden flex-1 sm:block" aria-label="Stäng" onClick={onClose} />
      <div className="flex h-full w-full max-w-md animate-[fade-in_0.2s_ease-out] flex-col border-l border-border bg-background shadow-2xl">
        <header
          className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative shrink-0">
              <img
                src={andreaAvatar}
                alt="Andrea"
                className={`size-10 rounded-full object-cover ring-2 ring-primary/30 ${isLoading ? "andrea-thinking" : ""}`}
              />
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-cat-ledig" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Andrea</p>
              <p className="truncate text-[11px] text-muted-foreground">{statusLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-pressed={voice.ttsEnabled}
              aria-label={voice.ttsEnabled ? "Stäng av uppläsning" : "Slå på uppläsning"}
              title={voice.ttsEnabled ? "Uppläsning på" : "Uppläsning av"}
              onClick={() => {
                if (voice.ttsEnabled) voice.stopSpeaking();
                voice.setTtsEnabled(!voice.ttsEnabled);
              }}
            >
              {voice.ttsEnabled ? (
                <Volume2 className="size-4 text-primary" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
            {messages.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Rensa historik"
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem(STORAGE_KEY);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onClose}
              aria-label="Stäng Andrea"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {voice.speaking ? (
            <div className="sticky top-0 z-10 flex justify-center">
              <button
                type="button"
                onClick={voice.stopSpeaking}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-lg"
              >
                <VolumeX className="size-3.5" /> Tysta Andrea
              </button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <img
                  src={andreaAvatar}
                  alt="Andrea"
                  className="mt-0.5 size-8 shrink-0 rounded-full object-cover"
                />
                <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm">
                  <p className="font-medium">Hej! Jag håller koll på din tid.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Jag kan varna för krockar, hitta ledig tid och öppna rätt vy åt dig.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0">{s}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m, i) => {
            const text = textOf(m);
            const gotos = m.parts.filter(
              (p) =>
                (p as { type: string; state?: string }).type === "tool-goto" &&
                (p as { state?: string }).state === "output-available",
            ) as unknown as { output?: { route?: string; reason?: string } }[];

            const actions = m.parts.filter((p) =>
              isActionPart(p as ToolPart),
            ) as unknown as ToolPart[];

            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {text}
                  </p>
                </div>
              );
            }
            const thinking = isLoading && i === messages.length - 1;
            return (
              <div key={m.id} className="flex gap-3">
                <img
                  src={andreaAvatar}
                  alt="Andrea"
                  className={`mt-0.5 size-8 shrink-0 rounded-full object-cover ${thinking ? "andrea-thinking" : ""}`}
                />
                <div className="min-w-0 max-w-[85%] space-y-2">
                  {text ? (
                    <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:space-y-1">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : null}

                  {actions.map((part, k) => (
                    <ActionCard
                      key={k}
                      part={part}
                      onRespond={(approved) =>
                        addToolApprovalResponse({ id: part.approval!.id, approved })
                      }
                    />
                  ))}

                  {gotos.map((g, k) =>
                    g.output?.route ? (
                      <button
                        key={k}
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

              </div>
            );
          })}

          {status === "submitted" ? (
            <div className="flex gap-3">
              <img
                src={andreaAvatar}
                alt="Andrea"
                className="andrea-thinking mt-0.5 size-8 shrink-0 rounded-full object-cover"
              />
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Tänker…</span>
              </div>
            </div>
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
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          {voice.supported ? (
            <button
              type="button"
              className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                voice.listening
                  ? "bg-destructive text-destructive-foreground shadow-lg"
                  : "border border-border bg-surface text-foreground hover:border-primary/40"
              }`}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Sluta lyssna" : "Tala med Andrea"}
              title={voice.listening ? "Lyssnar – tryck för att sluta" : "Tala med Andrea"}
              onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
            >
              {voice.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {voice.listening ? (
                <span className="pointer-events-none absolute inset-0 animate-ping rounded-xl border-2 border-destructive/60" />
              ) : null}
            </button>
          ) : null}

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
            placeholder={voice.listening ? "Lyssnar…" : "Fråga Andrea…"}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-base outline-none focus:border-primary/50 sm:text-sm"
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-10 shrink-0 rounded-xl"
              aria-label="Stoppa Andrea"
              onClick={() => stop()}
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              disabled={!input.trim()}
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

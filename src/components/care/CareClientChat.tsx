import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  listCareMessages,
  sendCareMessage,
  startCareMeet,
} from "@/lib/care-messages.functions";

const ROLE_LABEL: Record<string, string> = {
  personal: "Personal",
  administrator: "Administratör",
  brukare: "Brukare",
  anhorig: "Anhörig",
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Meddelandetråd runt en brukare – personal, brukare och anhöriga skriver i samma tråd. */
export function CareClientChat({ clientId, title }: { clientId: string; title?: string }) {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(listCareMessages);
  const send = useServerFn(sendCareMessage);
  const startMeet = useServerFn(startCareMeet);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["care-messages", clientId],
    queryFn: () => fetchMessages({ data: { clientId } }),
    refetchInterval: 20000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [q.data?.messages.length]);

  const post = useMutation({
    mutationFn: () => send({ data: { clientId, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["care-messages", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meet = useMutation({
    mutationFn: () => startMeet({ data: { clientId } }),
    onSuccess: (res: { link: string }) => {
      void qc.invalidateQueries({ queryKey: ["care-messages", clientId] });
      window.open(res.link, "_blank", "noopener");
      toast.success("Videosamtalet är startat och länken ligger i tråden.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = (q.data?.messages ?? []) as {
    id: string;
    body: string;
    author_id: string;
    author_name: string;
    author_role: string;
    created_at: string;
  }[];
  const me = q.data?.me;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MessageCircle className="size-4" /> {title ?? "Meddelanden"}
        </h2>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={meet.isPending}
          onClick={() => meet.mutate()}
        >
          <Video className="mr-1.5 size-4" />
          {meet.isPending ? "Startar…" : "Starta videosamtal"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Personal, brukare och anhöriga skriver i samma tråd. Allt sparas hos verksamheten.
      </p>


      <div className="max-h-96 space-y-2 overflow-y-auto rounded-3xl border border-border/70 bg-card p-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Hämtar…</p>
        ) : q.error ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inga meddelanden än. Skriv det första nedan.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === me;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    mine ? "bg-primary text-primary-foreground" : "bg-secondary/60"
                  }`}
                >
                  <p className="text-[11px] font-medium opacity-80">
                    {m.author_name} · {ROLE_LABEL[m.author_role] ?? m.author_role} ·{" "}
                    {timeLabel(m.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={body}
          placeholder="Skriv ett meddelande…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) post.mutate();
          }}
        />
        <Button
          size="icon"
          disabled={!body.trim() || post.isPending}
          onClick={() => post.mutate()}
          aria-label="Skicka"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </section>
  );
}

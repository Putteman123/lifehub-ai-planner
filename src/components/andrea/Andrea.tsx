import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";

import {
  ArrowRight,
  Check,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import andreaAvatar from "@/assets/andrea-avatar.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMAND_COSTS,
  PRIORITY_LABEL,
  commandsPerCredit,
  formatCredits,
} from "@/lib/ai-cost";
import { getAiCreditStatus } from "@/lib/ai-credits.functions";
import type { AiCreditStatus } from "@/lib/ai-credits.server";
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

/** Bifogad fil som laddats upp men ännu inte skickats till Andrea. */
type Attachment = {
  name: string;
  mediaType: string;
  dataUrl: string;
  storagePath: string;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Kunde inte läsa filen."));
    reader.readAsDataURL(file);
  });
}

/** Historik utan tunga fildata så localStorage inte spränger kvoten. */
function slimForStorage(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter((p) => (p as { type: string }).type !== "file"),
  }));
}

/** Verktyg som ändrar data i appen och därför måste godkännas. */
const ACTION_LABELS: Record<string, string> = {
  create_event: "Lägga in en händelse i kalendern",
  update_event: "Ändra en kalenderhändelse",
  delete_event: "Ta bort en kalenderhändelse",
  create_todo: "Lägga till en uppgift i Att göra",
  complete_todo: "Bocka av en uppgift",
  delete_todo: "Ta bort en uppgift",
  create_reminder: "Skapa en påminnelse",
  create_case: "Skapa ett juristärende",
  create_case_task: "Lägga till en juristuppgift",
  create_child: "Lägga till ett barn",
  create_place: "Spara en ny plats",
  update_place: "Ändra en plats",
  delete_place: "Ta bort en plats",
  name_visit: "Namnge ett besök",
  delete_visit: "Ta bort en post i platsloggen",
  check_in: "Checka in på en plats",
  end_visit: "Avsluta pågående besök",
  save_uploaded_file: "Spara den uppladdade filen",
  add_pantry_items: "Lägga in varorna i skafferiet",
  log_receipt_place: "Markera butiken på kartan och i kalendern",
};

type ToolPart = {
  type: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: { message?: string };
  errorText?: string;
  approval?: { id: string };
};

function toolName(part: ToolPart) {
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

function actionName(part: ToolPart) {
  const name = toolName(part);
  return name in ACTION_LABELS ? name : null;
}

/** Läsverktyg som aldrig ska synas som åtgärdskort i chatten. */
const SILENT_TOOLS = new Set(["goto", "find_item", "find_free_time", "suggest_category", "lookup_prices"]);

function isActionPart(part: ToolPart) {
  if (!part.type.startsWith("tool-")) return false;
  const name = toolName(part);
  // Godkännande måste ALLTID visas – annars låser sig chatten i väntan på svar.
  if (part.state === "approval-requested") return true;
  if (SILENT_TOOLS.has(name)) return false;
  if (!actionName(part) && part.state === "output-available") return false;
  return (
    part.state === "output-available" ||
    part.state === "output-error" ||
    part.state === "output-denied"
  );
}

function ActionCard({
  part,
  onRespond,
}: {
  part: ToolPart;
  onRespond: (approved: boolean) => void;
}) {
  const name = actionName(part);
  const label = name
    ? ACTION_LABELS[name]
    : toolName(part).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());


  if (part.state === "approval-requested") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
        <p className="font-medium text-foreground">{label}?</p>
        <ActionDetails input={part.input} />
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" className="h-8 flex-1 text-xs" onClick={() => onRespond(true)}>
            <Check className="mr-1 size-3.5" /> Godkänn
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 text-xs"
            onClick={() => onRespond(false)}
          >
            <X className="mr-1 size-3.5" /> Avbryt
          </Button>
        </div>
      </div>
    );
  }

  if (part.state === "output-denied") {
    return (
      <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {label} – avbruten.
      </p>
    );
  }

  if (part.state === "output-error") {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {label} misslyckades. {part.errorText ?? ""}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-1.5 rounded-xl border border-cat-ledig/40 bg-cat-ledig/10 px-3 py-2 text-xs text-foreground">
      <Check className="mt-0.5 size-3.5 shrink-0 text-cat-ledig" />
      <span>{part.output?.message ?? `${label} – klart.`}</span>
    </p>
  );
}

const FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  starts_at: "Från",
  ends_at: "Till",
  category: "Kategori",
  location: "Plats",
  description: "Beskrivning",
  due_date: "Senast",
  remind_at: "Påminn",
  notes: "Anteckning",
  note: "Anteckning",
  label: "Namn",
  name: "Namn",
  kind: "Typ",
  radius_m: "Radie (m)",
  client_name: "Klient",
  address: "Adress",
  birth_date: "Födelsedatum",
  all_day: "Heldag",
  delete_visits: "Radera besök",
};

function ActionDetails({ input }: { input?: Record<string, unknown> | undefined }) {
  const rows = Object.entries(input ?? {}).filter(
    ([key, value]) => key in FIELD_LABELS && value !== null && value !== undefined && value !== "",
  );
  if (rows.length === 0) return null;
  return (
    <dl className="mt-1.5 space-y-0.5 text-muted-foreground">
      {rows.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="shrink-0">{FIELD_LABELS[key]}:</dt>
          <dd className="min-w-0 break-words text-foreground">
            {typeof value === "boolean" ? (value ? "Ja" : "Nej") : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}


const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Startsidan",
  "/kalender": "Kalendern",
  "/kalendrar": "Kalendrar",
  "/attgora": "Att göra",
  "/handla": "Handla (inköpslista, skafferi och prisbok)",
  "/pengar": "Pengar (konton, köp, fasta utgifter, lån)",
  "/platser": "Platser (besök, resor och dagskarta)",
  "/barn": "Barn",
  "/jurist": "Jurist",
  "/iptv": "IPTV",
  "/kassaskap": "Kassaskåpet",
};

export function Andrea() {
  const [open, setOpen] = useState(false);
  const [voiceStart, setVoiceStart] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function beginHold() {
    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      setVoiceStart(true);
      setOpen(true);
    }, 500);
  }

  function endHold() {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
      setVoiceStart(false);
      setOpen(true);
    }
  }

  return (
    <>
      {!open ? (
        <button
          onPointerDown={beginHold}
          onPointerUp={endHold}
          onPointerLeave={() => {
            if (holdRef.current) {
              clearTimeout(holdRef.current);
              holdRef.current = null;
            }
          }}
          aria-label="Öppna Andrea"
          title="Tryck för att chatta – håll in för röstläge"
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
      {open ? (
        <AndreaPanel
          autoVoice={voiceStart}
          onClose={() => {
            setOpen(false);
            setVoiceStart(false);
          }}
        />
      ) : null}
    </>
  );
}

type AndreaError = { code: string; status: string; text: string; reason?: string };

/** Tolkar fel från chatt-API:t till kod, statuskod och läsbar text. */
function parseError(error: Error): AndreaError {
  const msg = (error.message ?? "").trim();
  const coded = /^(credits|rate|auth|upstream|unknown)\|([^|]*)\|([\s\S]*)$/.exec(msg);
  if (coded) {
    const [, code, status, rest] = coded;
    if (code === "credits")
      return {
        code,
        status: status || "403",
        reason: rest || "credit_hard_block_workspace",
        text: "AI-krediterna är slut eller spärrade för arbetsytan.",
      };
    return { code: code!, status: status ?? "", text: rest || "Något gick fel." };
  }
  if (/40[23]/.test(msg) || /krediter|credit/i.test(msg))
    return {
      code: "credits",
      status: "403",
      reason: "credit_hard_block_workspace",
      text: "AI-krediterna är slut eller spärrade för arbetsytan.",
    };
  if (msg.includes("429"))
    return { code: "rate", status: "429", text: "För många frågor just nu – vänta en stund." };
  if (msg.includes("401"))
    return { code: "auth", status: "401", text: "Inloggningen gick ut. Ladda om appen." };
  if (/failed to fetch|network/i.test(msg))
    return { code: "network", status: "", text: "Ingen kontakt med AI-tjänsten." };
  return { code: "unknown", status: "", text: msg || "Något gick fel. Försök igen." };
}

const CREDITS_URL = "https://lovable.dev/settings/workspace?tab=billing";

function formatSv(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdown(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "när som helst nu";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `om ${d} d ${rest} h`;
  if (h > 0) return `om ${h} h ${m} min`;
  return `om ${m} min`;
}

/** Kreditstatus med exakt saldo, spärrtid och flöde för påfyllning. */
function CreditStatus({
  info,
  checking,
  onRetry,
  voiceNote,
}: {
  info: AndreaError;
  checking: boolean;
  onRetry: () => void;
  voiceNote?: string | null;
}) {
  const [openedTopUp, setOpenedTopUp] = useState(false);
  const [status, setStatus] = useState<AiCreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setLoading(true);
    getAiCreditStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const limitReached = status?.type === "credit_limit_reached";

  return (
    <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-destructive">
          {status && !status.blocked ? "Krediterna är tillgängliga igen" : "AI-krediterna är slut"}
        </p>
        <p className="text-destructive/90">
          Alla AI-anrop blockeras just nu av arbetsytan (HTTP {status?.status ?? info.status}{" "}
          <span className="font-mono">{status?.type ?? info.reason}</span>). Det är inget fel i
          appen – varken snabbfilen eller djupfilen får köra förrän krediterna fylls på eller
          kreditgränsen höjs.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-1.5 rounded-lg border border-destructive/30 bg-background/40 p-2.5 text-destructive/90 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <dt className="font-medium">Krediter kvar</dt>
          <dd className="tabular-nums font-semibold">
            {loading
              ? "kontrollerar…"
              : status
                ? status.blocked
                  ? `${status.remaining ?? 0} krediter (spärr aktiv)`
                  : "tillgängliga"
                : "okänt"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <dt className="font-medium">Spärren släpper</dt>
          <dd className="text-right tabular-nums font-semibold">
            {loading
              ? "…"
              : status?.resetsAt
                ? `${formatSv(status.resetsAt)} (${countdown(status.resetsAt, now)})`
                : status && !status.blocked
                  ? "redan släppt"
                  : status?.requires === "top_up"
                    ? "direkt efter påfyllning"
                    : "när gränsen höjs"}
          </dd>
        </div>
        {status?.details ? (
          <p className="sm:col-span-2 text-destructive/80">{status.details}</p>
        ) : null}
        {limitReached ? (
          <p className="sm:col-span-2 text-destructive/80">
            Månadsgränsen för AI räknas per kalendermånad och nollställs vid månadsskiftet – höj
            gränsen för att komma igång tidigare.
          </p>
        ) : null}
      </dl>

      <details className="rounded-lg border border-destructive/30 bg-background/40 p-2.5">
        <summary className="cursor-pointer font-medium text-destructive">
          Detaljer om kontrollen
        </summary>
        <dl className="mt-2 space-y-1 text-destructive/85">
          <div className="flex justify-between gap-2">
            <dt>AI-tjänst</dt>
            <dd className="text-right font-medium">{status?.service ?? "Lovable AI Gateway"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Endpoint</dt>
            <dd className="break-all text-right font-mono text-[10px]">
              {status?.endpoint ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Kontrollmodell</dt>
            <dd className="text-right font-mono text-[10px]">{status?.model ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Svarstid</dt>
            <dd className="text-right tabular-nums">
              {status ? `${status.latencyMs} ms` : loading ? "…" : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Feltyp</dt>
            <dd className="text-right font-mono text-[10px]">
              {status ? (status.blocked ? `${status.status} ${status.type ?? ""}` : "inget fel") : "—"}
            </dd>
          </div>
          {status?.requestId ? (
            <div className="flex justify-between gap-2">
              <dt>Spårnings-id</dt>
              <dd className="break-all text-right font-mono text-[10px]">{status.requestId}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      <details className="rounded-lg border border-destructive/30 bg-background/40 p-2.5">
        <summary className="cursor-pointer font-medium text-destructive">
          Vad kostar mina kommandon?
        </summary>
        <ul className="mt-2 space-y-2 text-destructive/85">
          {COMMAND_COSTS.map((c) => (
            <li key={c.id} className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.label}</span>
                <span className="tabular-nums font-semibold">≈ {formatCredits(c.credits)}</span>
              </div>
              <p className="text-[11px] text-destructive/70">
                {c.chain} · {PRIORITY_LABEL[c.priority]} ·{" "}
                {commandsPerCredit(c.credits) > 999
                  ? "tusentals per kredit"
                  : `~${commandsPerCredit(c.credits)} st per kredit`}
              </p>
              <p className="text-[11px] text-destructive/70">{c.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-destructive/80">
          Vid lågt saldo: kör snabbfilen och proaktiva koller som vanligt, spara djupanalyser och
          kvittoläsning till efter påfyllning, och stäng av uppläsningen (eller använd ElevenLabs)
          – då räcker saldot till många fler kommandon.
        </p>
      </details>



      <ol className="list-decimal space-y-1 pl-4 text-destructive/90">
        <li>Öppna arbetsytans krediter och fyll på (eller höj den satta gränsen).</li>
        <li>Kom tillbaka hit.</li>
        <li>Tryck ”Kontrollera och återuppta” – jag skickar om din senaste fråga.</li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <a
          href={CREDITS_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => setOpenedTopUp(true)}
          className="rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground"
        >
          Fyll på krediter
        </a>
        <button
          type="button"
          onClick={() => {
            refresh();
            onRetry();
          }}
          disabled={checking || loading}
          className="rounded-md border border-destructive/40 px-3 py-1.5 font-medium text-destructive disabled:opacity-60"
        >
          {checking || loading ? "Kontrollerar…" : "Kontrollera och återuppta"}
        </button>
      </div>

      {status ? (
        <p className="text-destructive/70">
          Senast kontrollerat {formatSv(status.checkedAt)}.
        </p>
      ) : null}
      {openedTopUp ? (
        <p className="text-destructive/80">
          När påfyllningen är klar återupptar jag automatiskt så snart du växlar tillbaka hit.
        </p>
      ) : null}
      {voiceNote ? <p className="text-destructive/80">{voiceNote}</p> : null}
    </div>
  );
}


function AndreaPanel({ onClose, autoVoice }: { onClose: () => void; autoVoice?: boolean }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pageRef = useRef({ path: pathname, label: PAGE_LABELS[pathname] ?? pathname });
  pageRef.current = { path: pathname, label: PAGE_LABELS[pathname] ?? pathname };

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      body: () => ({ page: pageRef.current }),
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
    regenerate,
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
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  async function pickFiles(list: FileList | null) {
    if (!list?.length) return;
    setFileError(null);
    setUploading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error("Du är inte inloggad.");

      const added: Attachment[] = [];
      for (const file of Array.from(list)) {
        if (file.size > MAX_FILE_BYTES) {
          setFileError(`${file.name} är för stor (max 8 MB).`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-åäöÅÄÖ]+/g, "_");
        const path = `${userId}/${Date.now()}-${safe}`;
        const up = await supabase.storage
          .from("andrea")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (up.error) throw new Error(up.error.message);
        added.push({
          name: file.name,
          mediaType: file.type || "application/octet-stream",
          dataUrl: await readAsDataUrl(file),
          storagePath: path,
        });
      }
      setFiles((prev) => [...prev, ...added]);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Uppladdningen misslyckades.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(text: string) {
    const value = text.trim();
    if (isLoading || uploading) return;
    if (!value && files.length === 0) return;
    const attached = files;
    setInput("");
    setFiles([]);

    if (attached.length === 0) {
      sendMessage({ text: value });
      return;
    }

    const note = attached
      .map((f) => `Bifogad fil: ${f.name} (${f.mediaType}), lagringsväg: ${f.storagePath}`)
      .join("\n");

    sendMessage({
      parts: [
        ...attached.map((f) => ({
          type: "file" as const,
          filename: f.name,
          mediaType: f.mediaType,
          url: f.dataUrl,
        })),
        { type: "text" as const, text: `${note}\n\n${value || "Vad är det här?"}` },
      ],
    });
  }


  const voiceModeRef = useRef(false);
  const voice = useVoice((text) => {
    voiceModeRef.current = true;
    submit(text);
  });
  const spokenRef = useRef<string | null>(null);
  const autoVoiceRef = useRef(false);

  const errorInfo = error ? parseError(error) : null;
  const [checking, setChecking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const notifiedRef = useRef<string | null>(null);

  const retry = useCallback(() => {
    setChecking(true);
    voice.stopSpeaking();
    void regenerate();
  }, [regenerate, voice]);

  // Sluta "kontrollera" så snart ett nytt försök har gått igenom eller fallerat.
  useEffect(() => {
    if (status === "streaming" || status === "ready" || status === "error") setChecking(false);
  }, [status]);

  // Handsfree efter AI-fel: mikrofonen får aldrig dö, och Andrea säger till en gång.
  useEffect(() => {
    if (!errorInfo) {
      setVoiceNote(null);
      notifiedRef.current = null;
      return;
    }
    voice.stopSpeaking();
    if (!voiceModeRef.current) return;

    if (voice.supported && !voice.listening) voice.startListening();
    setVoiceNote(
      'Mikrofonen är kvar på – säg "försök igen" när krediterna är påfyllda, eller "tyst" för att pausa.',
    );
    if (notifiedRef.current !== errorInfo.code) {
      notifiedRef.current = errorInfo.code;
      if (voice.ttsEnabled) {
        voice.speak(
          errorInfo.code === "credits"
            ? "AI-krediterna är slut. Fyll på, säg sedan försök igen så fortsätter jag."
            : errorInfo.text,
        );
      }
    }
  }, [errorInfo, voice]);

  // Rösten kan starta om samtalet utan att du rör skärmen.
  useEffect(() => {
    if (!errorInfo) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    const text = textOf(last).toLowerCase();
    if (/(försök igen|forsok igen|prova igen|fortsätt|kör igen)/.test(text)) retry();
  }, [messages, errorInfo, retry]);

  // Tillbaka i appen efter påfyllning: prova automatiskt en gång.
  useEffect(() => {
    if (!errorInfo || errorInfo.code !== "credits") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [errorInfo, retry]);


  // Håll in Andrea-knappen: panelen öppnas direkt i röstläge.
  useEffect(() => {
    if (!autoVoice || autoVoiceRef.current || !voice.supported) return;
    autoVoiceRef.current = true;
    voice.startListening();
  }, [autoVoice, voice]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) taRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slimForStorage(messages)));
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
              const attached = m.parts.filter(
                (p) => (p as { type: string }).type === "file",
              ) as unknown as { filename?: string; mediaType?: string; url?: string }[];
              const visible = text.replace(/^Bifogad fil:.*\n?/gm, "").trim();
              return (
                <div key={m.id} className="flex flex-col items-end gap-1.5">
                  {attached.length ? (
                    <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                      {attached.map((f, k) =>
                        f.mediaType?.startsWith("image/") && f.url ? (
                          <img
                            key={k}
                            src={f.url}
                            alt={f.filename ?? "Bifogad bild"}
                            className="size-24 rounded-xl border border-border object-cover"
                          />
                        ) : (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs"
                          >
                            <Paperclip className="size-3.5 text-muted-foreground" />
                            {f.filename ?? "Fil"}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                  {visible ? (
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {visible}
                    </p>
                  ) : null}
                </div>
              );
            }
            const thinking = isLoading && i === messages.length - 1;
            const reasoning = m.parts
              .filter((p) => (p as { type: string }).type === "reasoning")
              .map((p) => (p as { text?: string }).text ?? "")
              .join("\n")
              .trim();
            return (
              <div key={m.id} className="flex gap-3">
                <img
                  src={andreaAvatar}
                  alt="Andrea"
                  className={`mt-0.5 size-8 shrink-0 rounded-full object-cover ${thinking ? "andrea-thinking" : ""}`}
                />
                <div className="min-w-0 max-w-[85%] space-y-2">
                  {reasoning ? (
                    <details className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer list-none font-medium text-foreground/80">
                        {thinking && !text ? "Andrea tänker…" : "Andreas tankegång"}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{reasoning}</p>
                    </details>
                  ) : null}

                  {text ? (
                    <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:space-y-1">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  ) : null}

                  {actions.map((part, k) => (
                    <ActionCard
                      key={k}
                      part={part}
                      onRespond={(approved) => {
                        if (part.approval?.id)
                          addToolApprovalResponse({ id: part.approval.id, approved });
                      }}
                    />
                  ))}

                  {/* Svar utan text och utan åtgärd får aldrig se ut som en frysning. */}
                  {!thinking && !text && !actions.length && !gotos.length && reasoning ? (
                    <p className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
                      Jag kom inte hela vägen fram där. Säg till så tar jag om det.
                    </p>
                  ) : null}


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
          {errorInfo ? (
            errorInfo.code === "credits" ? (
              <CreditStatus
                info={errorInfo}
                checking={checking}
                onRetry={retry}
                voiceNote={voiceNote}
              />
            ) : (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <p>{errorInfo.text}</p>
                {voiceNote ? <p className="text-destructive/80">{voiceNote}</p> : null}
                <button
                  type="button"
                  onClick={retry}
                  disabled={checking}
                  className="rounded-md border border-destructive/40 px-2 py-1 font-medium disabled:opacity-60"
                >
                  {checking ? "Försöker…" : "Försök igen"}
                </button>
              </div>
            )
          ) : null}

          <div ref={endRef} />
        </div>

        {files.length || uploading || fileError ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 pt-2">
            {files.map((f, k) => (
              <span
                key={f.storagePath}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs"
              >
                {f.mediaType.startsWith("image/") ? (
                  <img src={f.dataUrl} alt="" className="size-5 rounded object-cover" />
                ) : (
                  <Paperclip className="size-3.5 text-muted-foreground" />
                )}
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Ta bort ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== k))}
                >
                  <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            ))}
            {uploading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Laddar upp…
              </span>
            ) : null}
            {fileError ? <span className="text-xs text-destructive">{fileError}</span> : null}
          </div>
        ) : null}

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => void pickFiles(e.target.files)}
          />
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
            aria-label="Bifoga bild eller PDF"
            title="Bifoga bild eller PDF"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </button>

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
              disabled={(!input.trim() && files.length === 0) || uploading}
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

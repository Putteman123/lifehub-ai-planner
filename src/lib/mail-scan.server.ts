/**
 * Läser inkommande mejl och plockar ut fakturor, kortkvitton,
 * prenumerationer och mötesförfrågningar. Endast serverkod får importera
 * den här filen.
 */
import { completeText, completeVision, type AiAttachment } from "@/lib/ai-complete.server";
import { suggestMeetingSlots } from "@/lib/meeting-slots";
import type { EventRow } from "@/lib/categories";

export type MailFindingKind = "faktura" | "kvitto" | "prenumeration" | "mote";

export type MailScanResult = {
  kind: MailFindingKind | "inget";
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  occurred_at: string | null;
  reference: string | null;
  category: string | null;
  interval_months: number | null;
  summary: string | null;
  meeting_minutes: number | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["faktura", "kvitto", "prenumeration", "mote", "inget"],
    },
    merchant: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string" },
    due_date: { type: "string", description: "YYYY-MM-DD eller tom sträng" },
    occurred_at: { type: "string", description: "YYYY-MM-DD eller tom sträng" },
    reference: { type: "string", description: "OCR eller fakturanummer" },
    category: { type: "string" },
    interval_months: { type: "number" },
    meeting_minutes: { type: "number", description: "Önskad möteslängd i minuter, 0 om okänt" },
    summary: { type: "string" },
  },
  required: [
    "kind",
    "merchant",
    "amount",
    "currency",
    "due_date",
    "occurred_at",
    "reference",
    "category",
    "interval_months",
    "meeting_minutes",
    "summary",
  ],
} as const;

const SYSTEM = [
  "Du är Andrea, en svensk assistent som läser mejl åt Patrick.",
  "Avgör vad mejlet handlar om:",
  '- "faktura" = något som ska betalas (räkning, avi, påminnelse, betalkrav) med eller utan förfallodatum.',
  '- "kvitto" = redan betalt: kortköp, orderbekräftelse med genomförd betalning, Klarna/Swish/PayPal-kvitto, biljett, app-köp.',
  '- "prenumeration" = återkommande abonnemang som dras löpande.',
  '- "mote" = någon vill boka ett möte, samtal eller träff med Patrick.',
  '- "inget" = nyhetsbrev, reklam, leveransinfo eller annat utan betalning eller mötesförfrågan.',
  "Läs även eventuella bilagor (PDF eller bild) – där ligger ofta själva kvittot eller fakturan.",
  "Ett kvitto räknas som kvitto även om beloppet bara står i bilagan eller i en tabell.",
  "Belopp anges i siffror utan valutatecken. Datum i formatet YYYY-MM-DD.",
  "Lämna fält tomma (tom sträng eller 0) när uppgiften saknas. Gissa aldrig belopp.",
  "Kategori väljs bland: Boende, Mat, Transport, Nöje, Prenumeration, Försäkring, Hälsa, Barn, Juridik, Övrigt.",
].join("\n");

function clean(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : null;
}

function numberOrNull(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num !== 0 ? num : null;
}

/** Klassificerar ett enskilt mejl. Returnerar null när det inte är intressant. */
export async function classifyMail(input: {
  apiKey?: string;
  from: string;
  subject: string;
  date: string | null;
  body: string;
  attachments?: AiAttachment[];
}): Promise<MailScanResult | null> {
  const prompt = [
    `Från: ${input.from}`,
    `Ämne: ${input.subject}`,
    `Mejlets datum: ${input.date ?? "okänt"}`,
    "",
    input.body.slice(0, 5000),
  ].join("\n");

  const jsonSchema = {
    name: "mail_finding",
    schema: SCHEMA as unknown as Record<string, unknown>,
  };

  let raw: string;
  if (input.attachments?.length) {
    try {
      raw = await completeVision({
        system: SYSTEM,
        input: prompt,
        attachments: input.attachments,
        jsonSchema,
      });
    } catch (error) {
      console.warn("bilaga kunde inte läsas, kör på texten", error);
      raw = await completeText({
        ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        system: SYSTEM,
        input: prompt,
        jsonSchema,
      });
    }
  } else {
    raw = await completeText({
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      system: SYSTEM,
      input: prompt,
      jsonSchema,
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const kind = clean(parsed["kind"]);
  if (!kind || kind === "inget") return null;
  if (!["faktura", "kvitto", "prenumeration", "mote"].includes(kind)) return null;

  const amount = numberOrNull(parsed["amount"]);
  if (kind !== "mote" && !amount) return null;

  return {
    kind: kind as MailFindingKind,
    merchant: clean(parsed["merchant"]),
    amount,
    currency: clean(parsed["currency"]) ?? "SEK",
    due_date: clean(parsed["due_date"]),
    occurred_at: clean(parsed["occurred_at"]),
    reference: clean(parsed["reference"]),
    category: clean(parsed["category"]),
    interval_months: numberOrNull(parsed["interval_months"]),
    summary: clean(parsed["summary"]),
    meeting_minutes: numberOrNull(parsed["meeting_minutes"]),
  };
}

type ScanClient = {
  from: (table: string) => any;
};

/** Sökfrågor som körs i tur och ordning – bredare än en enda fråga. */
function buildQueries(days: number): string[] {
  const window = `newer_than:${days}d`;
  return [
    `${window} category:purchases`,
    `${window} (kvitto OR "ditt kvitto" OR "ditt köp" OR orderbekräftelse OR "tack för din beställning" OR "din order" OR receipt OR "order confirmation" OR "payment received" OR betalningsbekräftelse)`,
    `${window} (faktura OR räkning OR avi OR "att betala" OR påminnelse OR inbetalning OR OCR OR invoice OR "amount due" OR förfallodag)`,
    `${window} (from:klarna OR from:swish OR from:paypal OR from:stripe OR from:swedbankpay OR from:apple OR from:google OR from:amazon OR from:izettle OR from:zettle)`,
    `${window} (prenumeration OR abonnemang OR subscription OR "förnyas automatiskt" OR "renews on")`,
    `${window} (möte OR mötesförfrågan OR "boka tid" OR "kan vi ses" OR "passar det" OR "föreslå en tid" OR meeting OR "schedule a call")`,
  ];
}

/** Uppenbar reklam sållas bort innan AI körs. */
const NOISE = /(nyhetsbrev|newsletter|avregistrera|unsubscribe|rea |kampanj|erbjudande just nu|no-?reply@.*(news|marketing))/i;

function looksLikeNoise(mail: { from: string; subject: string; snippet: string }) {
  const text = `${mail.from} ${mail.subject} ${mail.snippet}`;
  if (!NOISE.test(text)) return false;
  // Reklam som ändå innehåller ett tydligt kvitto-/fakturaord släpps igenom.
  return !/(kvitto|faktura|räkning|receipt|invoice|order|betal)/i.test(text);
}

/**
 * Går igenom inkorgen och köar nya fynd. Delas av serverfunktionen och
 * Andreas verktyg.
 */
export async function scanInbox(
  supabase: ScanClient,
  userId: string,
  opts?: { max?: number; query?: string; days?: number; attachments?: boolean },
): Promise<{ connected: boolean; scanned: number; created: number; skipped: number }> {
  const { gmailListPaged, gmailMessageContent, hasGoogle, mailQueryWithRules } = await import(
    "./google.server"
  );
  if (!hasGoogle("mail")) return { connected: false, scanned: 0, created: 0, skipped: 0 };

  const days = opts?.days ?? 30;
  const max = Math.min(opts?.max ?? 120, 200);
  const queries = opts?.query ? [opts.query] : buildQueries(days);

  const byId = new Map<string, Awaited<ReturnType<typeof gmailListPaged>>[number]>();
  for (const base of queries) {
    if (byId.size >= max) break;
    try {
      const query = await mailQueryWithRules(base);
      const mails = await gmailListPaged(query, Math.max(20, Math.ceil(max / queries.length)));
      for (const mail of mails) if (!byId.has(mail.id)) byId.set(mail.id, mail);
    } catch (error) {
      console.warn("mail-scan query", base, error);
    }
  }

  const all = [...byId.values()];
  if (!all.length) return { connected: true, scanned: 0, created: 0, skipped: 0 };

  const ids = all.map((m) => m.id);
  const [{ data: knownFindings }, { data: knownSeen }] = await Promise.all([
    supabase.from("mail_findings").select("message_id").eq("user_id", userId).in("message_id", ids),
    supabase.from("mail_seen").select("message_id").eq("user_id", userId).in("message_id", ids),
  ]);
  const seen = new Set<string>([
    ...((knownFindings ?? []) as { message_id: string }[]).map((r) => r.message_id),
    ...((knownSeen ?? []) as { message_id: string }[]).map((r) => r.message_id),
  ]);

  const fresh = all.filter((mail) => !seen.has(mail.id));
  if (!fresh.length)
    return { connected: true, scanned: 0, created: 0, skipped: all.length };

  let created = 0;
  let scanned = 0;
  let skipped = all.length - fresh.length;
  let events: EventRow[] | null = null;

  for (const mail of fresh) {
    if (looksLikeNoise(mail)) {
      skipped += 1;
      await supabase
        .from("mail_seen")
        .upsert(
          { user_id: userId, message_id: mail.id, had_finding: false },
          { onConflict: "user_id,message_id" },
        );
      continue;
    }

    let hadFinding = false;
    try {
      const content = await gmailMessageContent(mail.id, {
        attachments: opts?.attachments !== false,
        maxAttachments: 3,
      });
      scanned += 1;
      const result = await classifyMail({
        from: mail.from,
        subject: mail.subject,
        date: mail.date,
        body: content.text,
        attachments: content.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          data: a.data,
        })),
      });

      if (result) {
        const occurred =
          result.occurred_at ?? (mail.date ? new Date(mail.date).toISOString() : null);
        const occurredIso =
          occurred && !Number.isNaN(new Date(occurred).getTime())
            ? new Date(occurred).toISOString()
            : null;

        let slots: { start: string; end: string }[] | null = null;
        if (result.kind === "mote") {
          if (!events) {
            const { data } = await supabase
              .from("events")
              .select("*")
              .eq("user_id", userId)
              .gte("starts_at", new Date().toISOString())
              .order("starts_at", { ascending: true })
              .limit(500);
            events = (data ?? []) as EventRow[];
          }
          slots = suggestMeetingSlots(events, {
            durationMinutes: result.meeting_minutes ?? 60,
            count: 3,
          }).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
        }

        const { error } = await supabase.from("mail_findings").insert({
          user_id: userId,
          message_id: mail.id,
          kind: result.kind,
          sender: mail.from,
          subject: mail.subject,
          merchant: result.merchant,
          amount: result.amount ?? 0,
          currency: result.currency ?? "SEK",
          due_date: result.due_date,
          occurred_at: occurredIso,
          reference: result.reference,
          category: result.category,
          summary: result.summary,
          suggested_slots: slots,
          attachment_names: content.attachments.map((a) => a.filename),
          raw_ai: result,
          status: "pending",
        });
        if (!error) {
          created += 1;
          hadFinding = true;
        }
      }
    } catch (error) {
      console.error("mail-scan", mail.id, error);
    }

    await supabase
      .from("mail_seen")
      .upsert(
        { user_id: userId, message_id: mail.id, had_finding: hadFinding },
        { onConflict: "user_id,message_id" },
      );
  }

  return { connected: true, scanned, created, skipped };
}

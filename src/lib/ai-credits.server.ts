export type AiCreditStatus = {
  /** true = alla AI-anrop nekas just nu */
  blocked: boolean;
  status: number;
  /** t.ex. credit_limit_reached, insufficient_credits */
  type: string | null;
  title: string | null;
  details: string | null;
  /** top_up eller admin_action */
  requires: string | null;
  scope: string | null;
  /** Krediter kvar i den blockerande perioden (0 när spärren slagit till). */
  remaining: number | null;
  /** ISO-tid när perioden nollställs och spärren släpper, om känd. */
  resetsAt: string | null;
  /** Sekunder att vänta vid 429. */
  retryAfterSeconds: number | null;
  checkedAt: string;
};

function nextMonthStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  ).toISOString();
}

/**
 * Gör ett minimalt anrop mot AI-gatewayen för att läsa av om krediterna är
 * spärrade, varför, och när spärren släpper.
 */
export async function probeAiCredits(): Promise<AiCreditStatus> {
  const checkedAt = new Date().toISOString();
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return {
      blocked: true,
      status: 401,
      type: "missing_api_key",
      title: "AI-nyckel saknas",
      details: "AI-tjänsten är inte konfigurerad för appen.",
      requires: "admin_action",
      scope: "workspace",
      remaining: null,
      resetsAt: null,
      retryAfterSeconds: null,
      checkedAt,
    };
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    }),
  });

  if (res.ok) {
    return {
      blocked: false,
      status: res.status,
      type: null,
      title: null,
      details: null,
      requires: null,
      scope: null,
      remaining: null,
      resetsAt: null,
      retryAfterSeconds: null,
      checkedAt,
    };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // gatewayen svarade utan JSON
  }
  const props = (body["props"] ?? {}) as Record<string, unknown>;
  const type = typeof body["type"] === "string" ? (body["type"] as string) : null;
  const retryAfter = Number(res.headers.get("retry-after"));
  const isLimit = res.status === 402 || res.status === 403;

  return {
    blocked: true,
    status: res.status,
    type,
    title: typeof body["title"] === "string" ? (body["title"] as string) : null,
    details: typeof body["details"] === "string" ? (body["details"] as string) : null,
    requires: typeof props["requires"] === "string" ? (props["requires"] as string) : null,
    scope: typeof props["scope"] === "string" ? (props["scope"] as string) : null,
    // Spärren slår till först när perioden är förbrukad – kvar är då exakt 0.
    remaining: isLimit ? 0 : null,
    // Gränser räknas per kalendermånad (UTC) och nollställs vid månadsskiftet.
    resetsAt: isLimit && type !== "insufficient_credits" ? nextMonthStartIso() : null,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    checkedAt,
  };
}

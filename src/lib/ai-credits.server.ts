const GATEWAY_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PROBE_MODEL = "google/gemini-3.1-flash-lite";

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
  /** Vilken AI-tjänst som kontrollerades. */
  service: string;
  /** Endpoint som kontrollen anropade. */
  endpoint: string;
  /** Modell som användes för kontrollanropet. */
  model: string;
  /** Svarstid i millisekunder för kontrollanropet. */
  latencyMs: number;
  /** Gatewayens spårnings-id för kontrollen. */
  requestId: string | null;
  /** Aktiv månadsgräns för Andrea i arbetsytan. */
  monthlyLimit: number;
};

const ANDREA_MONTHLY_AI_LIMIT = 100;

function nextMonthStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  ).toISOString();
}

/**
 * Gör ett minimalt anrop mot AI-gatewayen för att läsa av om krediterna är
 * spärrade, varför, när spärren släpper och hur snabbt tjänsten svarar.
 */
export async function probeAiCredits(): Promise<AiCreditStatus> {
  const checkedAt = new Date().toISOString();
  const base = {
    checkedAt,
    service: "Lovable AI Gateway",
    endpoint: GATEWAY_ENDPOINT,
    model: PROBE_MODEL,
    monthlyLimit: ANDREA_MONTHLY_AI_LIMIT,
  };
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return {
      ...base,
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
      latencyMs: 0,
      requestId: null,
    };
  }

  const started = Date.now();
  const res = await fetch(GATEWAY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: PROBE_MODEL,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    }),
  });
  const latencyMs = Date.now() - started;
  const requestId = res.headers.get("x-lovable-aig-log-id") ?? res.headers.get("x-request-id");

  if (res.ok) {
    return {
      ...base,
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
      latencyMs,
      requestId,
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
    ...base,
    blocked: true,
    status: res.status,
    type,
    title: typeof body["title"] === "string" ? (body["title"] as string) : null,
    details: typeof body["details"] === "string" ? (body["details"] as string) : null,
    requires: typeof props["requires"] === "string" ? (props["requires"] as string) : null,
    scope: typeof props["scope"] === "string" ? (props["scope"] as string) : null,
    // Gatewayen lämnar inte ut ett exakt saldo i felsvaret. Visa därför inte
    // ett påhittat nollsaldo – arbetsytans riktiga saldo och gräns är skilda saker.
    remaining: null,
    // Gränser räknas per kalendermånad (UTC) och nollställs vid månadsskiftet.
    resetsAt: isLimit && type !== "insufficient_credits" ? nextMonthStartIso() : null,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    latencyMs,
    requestId,
  };
}

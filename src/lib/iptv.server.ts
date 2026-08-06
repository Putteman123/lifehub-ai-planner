/** Lågnivåklient mot aktiveringspanelens API. Endast server. */

const BASE = "https://activationpanel.net/api/api.php";

export type PanelResult = {
  ok: boolean;
  status: string;
  raw: unknown;
  message: string;
};

/** Anropar panelen med givna parametrar och normaliserar svaret. */
export async function callPanel(params: Record<string, string>): Promise<PanelResult> {
  const apiKey = process.env["IPTV_PANEL_API_KEY"];
  if (!apiKey) {
    return { ok: false, status: "error", raw: null, message: "IPTV_PANEL_API_KEY saknas." };
  }

  const url = new URL(BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();

  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* panelen svarade inte med JSON – behåll råtexten */
  }

  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const status = typeof obj["status"] === "string" ? obj["status"] : res.ok ? "ok" : "error";
  const result = obj["result"];
  const message =
    typeof result === "string"
      ? result
      : typeof obj["message"] === "string"
        ? (obj["message"] as string)
        : res.ok
          ? "OK"
          : `HTTP ${res.status}`;

  return { ok: res.ok && status !== "error", status, raw, message };
}

/** Plockar ut m3u-länk, användaruppgifter och utgångsdatum ur ett panelsvar. */
export function extractLine(raw: unknown) {
  const src = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const nested = (
    typeof src["result"] === "object" && src["result"] !== null ? src["result"] : src
  ) as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = nested[k] ?? src[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return null;
  };

  const expRaw = pick("exp_date", "expire", "expiry", "expiration", "exp");
  let expiresAt: string | null = null;
  if (expRaw) {
    const asNumber = Number(expRaw);
    const date = Number.isFinite(asNumber) && asNumber > 1_000_000_000
      ? new Date(asNumber * 1000)
      : new Date(expRaw);
    if (!Number.isNaN(date.getTime())) expiresAt = date.toISOString();
  }

  return {
    panelId: pick("id", "line_id", "sub_id", "user_id"),
    m3uUrl: pick("m3u", "m3u_url", "url", "link", "playlist"),
    username: pick("username", "user"),
    password: pick("password", "pass"),
    expiresAt,
  };
}

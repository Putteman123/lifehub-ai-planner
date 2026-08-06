/** Lågnivåklient mot aktiveringspanelens API (activationpanel.net). Endast server. */

const BASE = "https://activationpanel.net/api/api.php";

export type PanelResult = {
  ok: boolean;
  raw: unknown;
  /** Första objektet i svaret, normaliserat (panelen svarar ofta med en array). */
  data: Record<string, unknown>;
  message: string;
};

function firstObject(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : {};
  }
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
}

/** Anropar panelen med givna parametrar och normaliserar svaret. */
export async function callPanel(params: Record<string, string>): Promise<PanelResult> {
  const apiKey = process.env["IPTV_PANEL_API_KEY"];
  if (!apiKey) {
    return { ok: false, raw: null, data: {}, message: "IPTV_PANEL_API_KEY saknas." };
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

  const data = firstObject(raw);
  const statusRaw = data["status"];
  const status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : statusRaw;
  const message =
    (typeof data["message"] === "string" && data["message"]) ||
    (typeof data["messasge"] === "string" && (data["messasge"] as string)) ||
    (typeof data["result"] === "string" && (data["result"] as string)) ||
    (res.ok ? "OK" : `HTTP ${res.status}`);

  // Panelen svarar med status "true" vid lyckat anrop och "error"/"false" vid fel.
  // Listsvar (t.ex. bouquet) saknar status helt.
  const hasStatus = status !== undefined;
  const ok = res.ok && (!hasStatus || status === "true" || status === true || status === 1);

  return { ok, raw, data, message: String(message) };
}

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const str = String(value).trim();
  const asNumber = Number(str);
  const date =
    Number.isFinite(asNumber) && asNumber > 1_000_000_000
      ? new Date(asNumber * 1000)
      : new Date(str.includes("T") ? str : `${str}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Plockar ut länk, användaruppgifter och utgångsdatum ur ett panelsvar. */
export function extractLine(result: PanelResult) {
  const d = result.data;
  const str = (key: string) => {
    const v = d[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
    return null;
  };

  return {
    panelId: str("user_id"),
    m3uUrl: str("url"),
    username: str("username"),
    password: str("password"),
    mac: str("mac"),
    protocolCode: str("code"),
    expiresAt: toIso(d["expire"] ?? d["exp_date"] ?? null),
  };
}

export type Bouquet = { id: string; name: string };

/** Hämtar panelens paketlista (bouquets). */
export async function fetchBouquets(): Promise<Bouquet[]> {
  const res = await callPanel({ action: "bouquet" });
  if (!Array.isArray(res.raw)) return [];
  return (res.raw as Record<string, unknown>[])
    .filter((b) => b && b["id"] != null)
    .map((b) => ({ id: String(b["id"]), name: String(b["name"] ?? b["id"]).trim() }));
}

export type PanelLine = {
  panelId: string | null;
  username: string | null;
  password: string | null;
  mac: string | null;
  protocolCode: string | null;
  m3uUrl: string | null;
  expiresAt: string | null;
  enabled: boolean;
};

/**
 * Hämtar aktuell status för en enskild linje via `device_info`.
 * Panelens API saknar en listnings-action, därför synkas rad för rad.
 */
export async function lookupLine(params: {
  deviceType: string;
  username?: string | null;
  password?: string | null;
  mac?: string | null;
}): Promise<{ ok: boolean; message: string; line: PanelLine | null }> {
  const query: Record<string, string> = { action: "device_info" };
  if (params.deviceType === "mag") {
    if (!params.mac) return { ok: false, message: "MAC-adress saknas.", line: null };
    query["mac"] = params.mac;
  } else {
    if (!params.username || !params.password) {
      return { ok: false, message: "Användarnamn eller lösenord saknas.", line: null };
    }
    query["username"] = params.username;
    query["password"] = params.password;
  }

  const res = await callPanel(query);
  if (!res.ok) return { ok: false, message: res.message, line: null };

  const info = extractLine(res);
  const enabledRaw = res.data["enabled"];
  return {
    ok: true,
    message: res.message,
    line: {
      ...info,
      enabled: !(enabledRaw === "0" || enabledRaw === 0 || enabledRaw === false),
    },
  };
}

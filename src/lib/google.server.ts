/**
 * Google-tjänster via Lovables connector-gateway.
 * Alla anrop går genom gatewayen – aldrig direkt mot Google.
 * Endast serverkod får importera den här filen.
 */

const GATEWAY = "https://connector-gateway.lovable.dev";

export const GOOGLE_CONNECTORS = {
  calendar: { id: "google_calendar", env: "GOOGLE_CALENDAR_API_KEY", label: "Google Calendar" },
  mail: { id: "google_mail", env: "GOOGLE_MAIL_API_KEY", label: "Gmail" },
  drive: { id: "google_drive", env: "GOOGLE_DRIVE_API_KEY", label: "Google Drive" },
  docs: { id: "google_docs", env: "GOOGLE_DOCS_API_KEY", label: "Google Docs" },
  sheets: { id: "google_sheets", env: "GOOGLE_SHEETS_API_KEY", label: "Google Sheets" },
  maps: { id: "google_maps", env: "GOOGLE_MAPS_API_KEY", label: "Google Maps" },
} as const;

export type GoogleService = keyof typeof GOOGLE_CONNECTORS;

/** Egen Google Maps-nyckel (fungerar på alla domäner, t.ex. mellberg.online). */
export function ownMapsKey() {
  return process.env["GOOGLE_MAPS_OWN_KEY"] ?? null;
}

export function hasGoogle(service: GoogleService) {
  if (service === "maps" && ownMapsKey()) return true;
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env[GOOGLE_CONNECTORS[service].env]);
}

/** Rätt Google-värd för en gateway-sökväg när vi ringer Google direkt. */
function directMapsUrl(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  const prefixes: Record<string, string> = {
    "routes/": "https://routes.googleapis.com/",
    "places/": "https://places.googleapis.com/",
    "airquality/": "https://airquality.googleapis.com/",
    "weather/": "https://weather.googleapis.com/",
    "pollen/": "https://pollen.googleapis.com/",
    "addressvalidation/": "https://addressvalidation.googleapis.com/",
  };
  for (const [prefix, host] of Object.entries(prefixes)) {
    if (clean.startsWith(prefix)) return `${host}${clean.slice(prefix.length)}`;
  }
  return `https://maps.googleapis.com/${clean}`;
}

async function callMapsDirect(
  key: string,
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": key,
    ...(init?.headers ?? {}),
  };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";

  const url = new URL(directMapsUrl(path));
  // Legacy-API:er (geocoding m.fl.) vill ha nyckeln som query-parameter.
  if (url.hostname === "maps.googleapis.com") url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Google Maps (egen nyckel) ${res.status}: ${text.slice(0, 400)}`);
    throw new Error(`Google Maps svarade ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as unknown) : null;
}

async function call(
  service: GoogleService,
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<unknown> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectorKey = process.env[GOOGLE_CONNECTORS[service].env];

  if (service === "maps") {
    const own = ownMapsKey();
    if (own) {
      const canFallBack = Boolean(lovableKey && connectorKey);
      try {
        return await callMapsDirect(own, path, init);
      } catch (error) {
        // Egen nyckel saknar behörighet för just den här tjänsten –
        // prova Lovables karttjänst istället för att låta funktionen dö.
        if (!canFallBack) throw error;
        console.warn(
          `Egen Google-nyckel funkade inte för ${path} – använder Lovables karttjänst istället.`,
        );
      }
    }
  }
  if (!lovableKey || !connectorKey) {
    throw new Error(`${GOOGLE_CONNECTORS[service].label} är inte kopplad.`);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectorKey,
    ...(init?.headers ?? {}),
  };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${GATEWAY}/${GOOGLE_CONNECTORS[service].id}${path}`, {
    method: init?.method ?? "GET",
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Google ${service} ${res.status}: ${text}`);
    throw new Error(`${GOOGLE_CONNECTORS[service].label} svarade ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as unknown) : null;
}

/* ---------------- Calendar ---------------- */

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
};

export async function listGoogleCalendars(): Promise<GoogleCalendarSummary[]> {
  const data = (await call("calendar", "/calendar/v3/users/me/calendarList?maxResults=250")) as {
    items?: Array<{ id: string; summary?: string; primary?: boolean; backgroundColor?: string }>;
  };
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary ?? c.id,
    primary: Boolean(c.primary),
    backgroundColor: c.backgroundColor ?? null,
  }));
}

export type GoogleEvent = {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};

export async function fetchGoogleEvents(
  calendarId: string,
  fromIso: string,
  toIso: string,
): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeMin: fromIso,
      timeMax: toIso,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = (await call(
      "calendar",
      `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    )) as {
      items?: Array<{
        id: string;
        status?: string;
        summary?: string;
        description?: string;
        location?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
      nextPageToken?: string;
    };

    for (const item of data.items ?? []) {
      if (item.status === "cancelled") continue;
      const startRaw = item.start?.dateTime ?? item.start?.date;
      const endRaw = item.end?.dateTime ?? item.end?.date ?? startRaw;
      if (!startRaw || !endRaw) continue;
      const allDay = !item.start?.dateTime;
      out.push({
        uid: `gcal:${item.id}`,
        title: item.summary ?? "(utan titel)",
        description: item.description ?? null,
        location: item.location ?? null,
        starts_at: new Date(startRaw).toISOString(),
        ends_at: new Date(endRaw).toISOString(),
        all_day: allDay,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

export async function createGoogleEvent(
  calendarId: string,
  input: { title: string; startsAt: string; endsAt: string; location?: string; description?: string },
) {
  const body = {
    summary: input.title,
    location: input.location,
    description: input.description,
    start: { dateTime: new Date(input.startsAt).toISOString() },
    end: { dateTime: new Date(input.endsAt).toISOString() },
  };
  const data = (await call(
    "calendar",
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body },
  )) as { id?: string; htmlLink?: string };
  return { id: data.id ?? null, link: data.htmlLink ?? null };
}

/** Uppdatera en befintlig Google-händelse. */
export async function updateGoogleEvent(
  calendarId: string,
  eventId: string,
  input: { title: string; startsAt: string; endsAt: string; location?: string; description?: string },
) {
  const body = {
    summary: input.title,
    location: input.location ?? null,
    description: input.description ?? null,
    start: { dateTime: new Date(input.startsAt).toISOString() },
    end: { dateTime: new Date(input.endsAt).toISOString() },
  };
  const data = (await call(
    "calendar",
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body },
  )) as { id?: string; htmlLink?: string };
  return { id: data.id ?? eventId, link: data.htmlLink ?? null };
}

/** Ta bort en händelse ur Google-kalendern. */
export async function deleteGoogleEvent(calendarId: string, eventId: string) {
  await call(
    "calendar",
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  return { deleted: true };
}

/* ---------------- Gmail ---------------- */

export type MailSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
};

function header(headers: Array<{ name?: string; value?: string }>, name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function gmailList(query: string, max = 8): Promise<MailSummary[]> {
  const list = (await call(
    "mail",
    `/gmail/v1/users/me/messages?maxResults=${Math.min(max, 25)}&q=${encodeURIComponent(query)}`,
  )) as { messages?: Array<{ id: string }> };

  const ids = (list.messages ?? []).map((m) => m.id);
  const details = await Promise.all(
    ids.map(async (id) => {
      const msg = (await call(
        "mail",
        `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      )) as {
        id: string;
        snippet?: string;
        labelIds?: string[];
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      };
      const headers = msg.payload?.headers ?? [];
      const summary: MailSummary = {
        id: msg.id,
        from: header(headers, "From"),
        subject: header(headers, "Subject") || "(utan ämne)",
        snippet: msg.snippet ?? "",
        date: header(headers, "Date") || null,
        unread: (msg.labelIds ?? []).includes("UNREAD"),
      };
      return summary;
    }),
  );
  return details;
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function collectText(part: GmailPart | undefined, want: string): string {
  if (!part) return "";
  if (part.mimeType === want && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const found = collectText(child, want);
    if (found) return found;
  }
  return "";
}

/** Hämtar brödtexten (ren text) för ett mejl, max ~6000 tecken. */
export async function gmailMessageBody(id: string): Promise<string> {
  const msg = (await call("mail", `/gmail/v1/users/me/messages/${id}?format=full`)) as {
    payload?: GmailPart;
    snippet?: string;
  };
  const plain = collectText(msg.payload, "text/plain");
  const html = plain ? "" : collectText(msg.payload, "text/html");
  const text =
    plain ||
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&") ||
    msg.snippet ||
    "";
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 6000);
}

/** Hämtar mejl-id sidvis så att fler än 25 mejl kan gås igenom per svep. */
export async function gmailListPaged(query: string, max = 120): Promise<MailSummary[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const page = Math.min(100, max - ids.length);
    const list = (await call(
      "mail",
      `/gmail/v1/users/me/messages?maxResults=${page}&q=${encodeURIComponent(query)}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""),
    )) as { messages?: Array<{ id: string }>; nextPageToken?: string };
    for (const m of list.messages ?? []) ids.push(m.id);
    if (!list.nextPageToken || !(list.messages ?? []).length) break;
    pageToken = list.nextPageToken;
  }

  const out: MailSummary[] = [];
  const chunk = 10;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = await Promise.all(
      ids.slice(i, i + chunk).map(async (id) => {
        try {
          const msg = (await call(
            "mail",
            `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          )) as {
            id: string;
            snippet?: string;
            labelIds?: string[];
            payload?: { headers?: Array<{ name?: string; value?: string }> };
          };
          const headers = msg.payload?.headers ?? [];
          const summary: MailSummary = {
            id: msg.id,
            from: header(headers, "From"),
            subject: header(headers, "Subject") || "(utan ämne)",
            snippet: msg.snippet ?? "",
            date: header(headers, "Date") || null,
            unread: (msg.labelIds ?? []).includes("UNREAD"),
          };
          return summary;
        } catch {
          return null;
        }
      }),
    );
    for (const item of part) if (item) out.push(item);
  }
  return out;
}

export type MailAttachment = {
  filename: string;
  mimeType: string;
  /** base64 (standard, inte url-säker) */
  data: string;
  bytes: number;
};

const ATTACHMENT_TYPES = /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic|heif))$/i;

function collectAttachmentParts(
  part: GmailPart | undefined,
  out: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }>,
) {
  if (!part) return;
  const p = part as GmailPart & {
    filename?: string;
    body?: { data?: string; attachmentId?: string; size?: number };
  };
  if (p.filename && p.body?.attachmentId && ATTACHMENT_TYPES.test(p.mimeType ?? "")) {
    out.push({
      filename: p.filename,
      mimeType: (p.mimeType ?? "").toLowerCase(),
      attachmentId: p.body.attachmentId,
      size: p.body.size ?? 0,
    });
  }
  for (const child of part.parts ?? []) collectAttachmentParts(child, out);
}

/**
 * Hämtar både brödtext och (valfritt) bilagor som PDF/bild för ett mejl.
 * Bilagor större än `maxBytes` hoppas över.
 */
export async function gmailMessageContent(
  id: string,
  opts?: { attachments?: boolean; maxAttachments?: number; maxBytes?: number },
): Promise<{ text: string; attachments: MailAttachment[] }> {
  const msg = (await call("mail", `/gmail/v1/users/me/messages/${id}?format=full`)) as {
    payload?: GmailPart;
    snippet?: string;
  };
  const plain = collectText(msg.payload, "text/plain");
  const html = plain ? "" : collectText(msg.payload, "text/html");
  const raw =
    plain ||
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&") ||
    msg.snippet ||
    "";
  const text = raw.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 6000);

  if (!opts?.attachments) return { text, attachments: [] };

  const maxBytes = opts.maxBytes ?? 4_000_000;
  const found: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = [];
  collectAttachmentParts(msg.payload, found);
  const wanted = found
    .filter((a) => a.size > 0 && a.size <= maxBytes)
    .slice(0, opts.maxAttachments ?? 3);

  const attachments: MailAttachment[] = [];
  for (const item of wanted) {
    try {
      const data = (await call(
        "mail",
        `/gmail/v1/users/me/messages/${id}/attachments/${item.attachmentId}`,
      )) as { data?: string; size?: number };
      if (!data.data) continue;
      attachments.push({
        filename: item.filename,
        mimeType: item.mimeType === "image/jpg" ? "image/jpeg" : item.mimeType,
        data: data.data.replace(/-/g, "+").replace(/_/g, "/"),
        bytes: data.size ?? item.size,
      });
    } catch (error) {
      console.warn("gmail attachment", item.filename, error);
    }
  }
  return { text, attachments };
}



function base64(value: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function base64Url(value: string) {
  return base64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Rubriker med å/ä/ö måste MIME-kodas, annars blir de oläsliga. */
function mimeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${base64(value)}?=`;
}

export async function gmailSend(to: string, subject: string, body: string) {
  const raw = base64Url(
    [
      `To: ${to}`,
      `Subject: ${mimeHeader(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      body,
    ].join("\r\n"),
  );
  await call("mail", "/gmail/v1/users/me/messages/send", { method: "POST", body: { raw } });
  return { sent: true };
}

/* ---------------- Drive ---------------- */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  link: string | null;
};

export async function driveSearch(query: string, max = 10): Promise<DriveFile[]> {
  const q = query.trim()
    ? `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`
    : "trashed = false";
  const params = new URLSearchParams({
    q,
    pageSize: String(Math.min(max, 50)),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
  });
  const data = (await call("drive", `/drive/v3/files?${params.toString()}`)) as {
    files?: Array<{
      id: string;
      name: string;
      mimeType: string;
      modifiedTime?: string;
      webViewLink?: string;
    }>;
  };
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime ?? null,
    link: f.webViewLink ?? null,
  }));
}

/* ---------------- Docs ---------------- */

export async function docsCreate(title: string, text: string) {
  const doc = (await call("docs", "/v1/documents", { method: "POST", body: { title } })) as {
    documentId?: string;
  };
  if (!doc.documentId) throw new Error("Kunde inte skapa dokumentet.");
  if (text.trim()) {
    await call("docs", `/v1/documents/${doc.documentId}:batchUpdate`, {
      method: "POST",
      body: { requests: [{ insertText: { location: { index: 1 }, text } }] },
    });
  }
  return {
    documentId: doc.documentId,
    link: `https://docs.google.com/document/d/${doc.documentId}/edit`,
  };
}

/* ---------------- Sheets ---------------- */

export async function sheetsExport(title: string, rows: (string | number)[][]) {
  const sheet = (await call("sheets", "/v4/spreadsheets", {
    method: "POST",
    body: { properties: { title } },
  })) as { spreadsheetId?: string; spreadsheetUrl?: string };
  if (!sheet.spreadsheetId) throw new Error("Kunde inte skapa kalkylarket.");

  await call(
    "sheets",
    `/v4/spreadsheets/${sheet.spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
    { method: "PUT", body: { values: rows } },
  );

  return {
    spreadsheetId: sheet.spreadsheetId,
    link:
      sheet.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
  };
}

/* ---------------- Maps ---------------- */

export type RouteResult = {
  mode: "bil" | "kollektivt" | "gang_cykel";
  minutes: number;
  km: number;
  meters: number;
  /** Kodad polyline för att rita rutten på kartan. */
  polyline: string | null;
};

const TRAVEL_MODE: Record<RouteResult["mode"], string> = {
  bil: "DRIVE",
  kollektivt: "TRANSIT",
  gang_cykel: "WALK",
};

export async function mapsRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: RouteResult["mode"] = "bil",
): Promise<RouteResult> {
  const data = (await call("maps", "/routes/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: TRAVEL_MODE[mode],
    },
  })) as {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }>;
  };

  const route = data.routes?.[0];
  if (!route) throw new Error("Ingen rutt hittades.");
  const seconds = Number((route.duration ?? "0s").replace("s", ""));
  const meters = route.distanceMeters ?? 0;
  return {
    mode,
    minutes: Math.round(seconds / 60),
    km: Math.round((meters / 1000) * 10) / 10,
    meters,
    polyline: route.polyline?.encodedPolyline ?? null,
  };
}

export type GeocodedPlace = {
  address: string;
  /** Kort namn: butik/byggnad eller gata. */
  shortName: string;
};

/** Slår upp adress för en koordinat via Googles geokodning. */
export async function geocodeLatLng(
  lat: number,
  lng: number,
): Promise<GeocodedPlace | null> {
  const data = (await call(
    "maps",
    `/maps/api/geocode/json?latlng=${lat},${lng}&language=sv&result_type=point_of_interest|premise|street_address|route|establishment`,
  )) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{ short_name?: string; types?: string[] }>;
    }>;
  };

  const first = data.results?.[0];
  if (!first?.formatted_address) return null;
  const components = first.address_components ?? [];
  const pick = (type: string) =>
    components.find((c) => c.types?.includes(type))?.short_name ?? null;
  const shortName =
    pick("point_of_interest") ??
    pick("establishment") ??
    pick("premise") ??
    [pick("route"), pick("street_number")].filter(Boolean).join(" ") ??
    first.formatted_address;

  return {
    address: first.formatted_address,
    shortName: shortName || first.formatted_address,
  };
}

export type GeocodedPoint = GeocodedPlace & { lat: number; lng: number };

/** Slår upp koordinater för en adress eller ett butiksnamn. */
export async function geocodeAddress(query: string): Promise<GeocodedPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const data = (await call(
    "maps",
    `/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&language=sv&region=se`,
  )) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: Array<{ short_name?: string; types?: string[] }>;
    }>;
  };

  const first = data.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (!first || typeof lat !== "number" || typeof lng !== "number") return null;

  const components = first.address_components ?? [];
  const pick = (type: string) =>
    components.find((c) => c.types?.includes(type))?.short_name ?? null;
  const shortName =
    pick("point_of_interest") ??
    pick("establishment") ??
    pick("premise") ??
    first.formatted_address ??
    trimmed;

  return {
    lat,
    lng,
    address: first.formatted_address ?? trimmed,
    shortName,
  };
}

export type NearbyPlace = {
  name: string;
  address: string | null;
  types: string[];
  meters: number;
  /** Ungefärlig popularitet – hjälper AI att välja rätt kandidat. */
  ratingCount: number | null;
};

/**
 * Platser i närheten av en koordinat via Places API (New).
 * Används för att sätta riktiga verksamhetsnamn på GPS-stopp.
 */
export async function placesNearby(
  lat: number,
  lng: number,
  radiusM = 130,
  max = 6,
): Promise<NearbyPlace[]> {
  const data = (await call("maps", "/places/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.types,places.location,places.userRatingCount",
    },
    body: {
      maxResultCount: Math.min(Math.max(max, 1), 20),
      languageCode: "sv",
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(Math.max(radiusM, 20), 1000),
        },
      },
    },
  })) as {
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      types?: string[];
      userRatingCount?: number;
      location?: { latitude?: number; longitude?: number };
    }>;
  };

  const toMeters = (aLat: number, aLng: number) => {
    const R = 6371000;
    const dLat = ((aLat - lat) * Math.PI) / 180;
    const dLng = ((aLng - lng) * Math.PI) / 180;
    const midLat = ((aLat + lat) / 2) * (Math.PI / 180);
    const x = dLng * Math.cos(midLat);
    return Math.round(Math.sqrt(dLat * dLat + x * x) * R);
  };

  return (data.places ?? [])
    .map((p) => ({
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? null,
      types: p.types ?? [],
      ratingCount: p.userRatingCount ?? null,
      meters:
        typeof p.location?.latitude === "number" && typeof p.location?.longitude === "number"
          ? toMeters(p.location.latitude, p.location.longitude)
          : 0,
    }))
    .filter((p) => p.name)
    .slice(0, max);
}

/* ---------------- Avståndsmatris ---------------- */

export type MatrixCell = {
  originIndex: number;
  destinationIndex: number;
  meters: number;
  minutes: number;
};

/**
 * Avstånd och restid mellan flera punkter i ett enda anrop (Routes computeRouteMatrix).
 * Max 10x10 för att hålla nere kostnaden.
 */
export async function mapsMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>,
  mode: RouteResult["mode"] = "bil",
): Promise<MatrixCell[]> {
  const waypoint = (p: { lat: number; lng: number }) => ({
    waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
  });

  const data = (await call("maps", "/routes/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "X-Goog-FieldMask":
        "originIndex,destinationIndex,duration,distanceMeters,condition",
    },
    body: {
      origins: origins.slice(0, 10).map(waypoint),
      destinations: destinations.slice(0, 10).map(waypoint),
      travelMode: TRAVEL_MODE[mode],
    },
  })) as
    | Array<{
        originIndex?: number;
        destinationIndex?: number;
        duration?: string;
        distanceMeters?: number;
        condition?: string;
      }>
    | null;

  return (data ?? [])
    .filter((row) => row.condition !== "ROUTE_NOT_FOUND")
    .map((row) => ({
      originIndex: row.originIndex ?? 0,
      destinationIndex: row.destinationIndex ?? 0,
      meters: row.distanceMeters ?? 0,
      minutes: Math.round(Number((row.duration ?? "0s").replace("s", "")) / 60),
    }));
}

/* ---------------- Platssök ---------------- */

export type PlaceSuggestion = { placeId: string; text: string };

/** Förslag medan man skriver (Places API New autocomplete). */
export async function placesAutocomplete(
  input: string,
  bias?: { lat: number; lng: number } | null,
  sessionToken?: string,
): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const body: Record<string, unknown> = {
    input: trimmed,
    languageCode: "sv",
    regionCode: "SE",
    ...(sessionToken ? { sessionToken } : {}),
  };
  if (bias) {
    body["locationBias"] = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 },
    };
  }

  const data = (await call("maps", "/places/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body,
  })) as {
    suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
  };

  return (data.suggestions ?? [])
    .map((s) => ({
      placeId: s.placePrediction?.placeId ?? "",
      text: s.placePrediction?.text?.text ?? "",
    }))
    .filter((s) => s.placeId && s.text)
    .slice(0, 6);
}

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

/** Detaljer för ett valt förslag. */
export async function placeDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceDetails | null> {
  const query = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const data = (await call("maps", `/places/v1/places/${encodeURIComponent(placeId)}${query}`, {
    headers: {
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  })) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    placeId: data.id ?? placeId,
    name: data.displayName?.text ?? data.formattedAddress ?? "Plats",
    address: data.formattedAddress ?? "",
    lat,
    lng,
  };
}





/** Lägger på användarens sparade mejlregler på en Gmail-sökfråga. */
export async function mailQueryWithRules(base: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildGmailQuery } = await import("./mail-rules");
    const { data } = await supabaseAdmin
      .from("mail_rules")
      .select("*")
      .eq("is_active", true);
    if (!data || data.length === 0) return base;
    return buildGmailQuery(base, data);
  } catch {
    return base;
  }
}

/* ---------------- Status / hälsa ---------------- */

export type GoogleHealth = {
  service: GoogleService;
  label: string;
  connected: boolean;
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
};

/** Verifierar en tjänsts credentials mot gatewayen utan att röra användardata. */
export async function checkGoogleService(service: GoogleService): Promise<GoogleHealth> {
  const { label, env } = GOOGLE_CONNECTORS[service];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectorKey = process.env[env];
  if (!lovableKey || !connectorKey) {
    return { service, label, connected: false, ok: false, error: "Inte kopplad", latencyMs: null };
  }
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY}/api/v1/verify_credentials`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectorKey,
      },
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return { service, label, connected: true, ok: false, error: `${res.status}: ${text.slice(0, 200)}`, latencyMs };
    }
    const body = text ? (JSON.parse(text) as { outcome?: string; error?: string }) : {};
    const ok = body.outcome !== "failed";
    return {
      service,
      label,
      connected: true,
      ok,
      error: ok ? null : (body.error ?? "Verifiering misslyckades"),
      latencyMs,
    };
  } catch (e) {
    return {
      service,
      label,
      connected: true,
      ok: false,
      error: e instanceof Error ? e.message : "Okänt fel",
      latencyMs: Date.now() - started,
    };
  }
}

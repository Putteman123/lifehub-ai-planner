/** Minimal ICS (RFC 5545) parser – räcker för prenumerationskalendrar. */

export type IcsEvent = {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescape(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Tolkar DATE (20260804) och DATE-TIME (20260804T070000[Z]). */
function parseIcsDate(value: string, params: Record<string, string>) {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || params["VALUE"] === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return {
      date: new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)),
      allDay: true,
    };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!dt) {
    const fallback = new Date(v);
    return isNaN(+fallback) ? null : { date: fallback, allDay: false };
  }
  const [, y, mo, d, h, mi, s, z] = dt;
  // Utan TZID/Z antas svensk tid; vi använder UTC-offset från zonen vid datumet.
  if (z) {
    return { date: new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!)), allDay: false };
  }
  const naive = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!);
  const tz = params["TZID"] ?? "Europe/Stockholm";
  const offset = tzOffsetMs(new Date(naive), tz);
  return { date: new Date(naive - offset), allDay: false };
}

function tzOffsetMs(date: Date, timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(date).map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asUTC = Date.UTC(
      +parts["year"]!,
      +parts["month"]! - 1,
      +parts["day"]!,
      +parts["hour"]! % 24,
      +parts["minute"]!,
      +parts["second"]!,
    );
    return asUTC - date.getTime();
  } catch {
    return 0;
  }
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current) {
        const ev = buildEvent(current);
        if (ev) events.push(ev);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const head = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    const [name, ...paramParts] = head.split(";");
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/"/g, "");
    }
    current[name!.toUpperCase()] = { value, params };
  }

  return events;
}

function buildEvent(
  fields: Record<string, { value: string; params: Record<string, string> }>,
): IcsEvent | null {
  const summary = fields["SUMMARY"]?.value;
  const dtstart = fields["DTSTART"];
  if (!dtstart) return null;
  const start = parseIcsDate(dtstart.value, dtstart.params);
  if (!start) return null;

  const dtend = fields["DTEND"];
  let end = dtend ? parseIcsDate(dtend.value, dtend.params) : null;
  if (!end) {
    const durationMs = parseDuration(fields["DURATION"]?.value);
    end = {
      date: new Date(start.date.getTime() + (durationMs ?? (start.allDay ? 86400000 : 3600000))),
      allDay: start.allDay,
    };
  }

  return {
    uid: fields["UID"]?.value?.trim() || `${dtstart.value}-${summary ?? ""}`,
    title: summary ? unescape(summary) : "Händelse",
    description: fields["DESCRIPTION"] ? unescape(fields["DESCRIPTION"].value) : null,
    location: fields["LOCATION"] ? unescape(fields["LOCATION"].value) : null,
    starts_at: start.date.toISOString(),
    ends_at: end.date.toISOString(),
    all_day: start.allDay,
  };
}

function parseDuration(value?: string) {
  if (!value) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  return (
    (+(m[1] ?? 0) * 86400 + +(m[2] ?? 0) * 3600 + +(m[3] ?? 0) * 60 + +(m[4] ?? 0)) * 1000
  );
}

export function normalizeIcsUrl(url: string) {
  const trimmed = url.trim();
  if (trimmed.startsWith("webcal://")) return `https://${trimmed.slice("webcal://".length)}`;
  return trimmed;
}

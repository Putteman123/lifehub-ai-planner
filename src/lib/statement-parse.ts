/** Ren tolkning av kontoutdrag (SEB/Revolut/generellt) – ingen AI, testbar. */
export type Bank = "seb" | "revolut" | "okänd";
export type StatementRow = { date: string; amount: number; text: string };
export type ExistingRow = { date: string; amount: number; text: string; kind: "spend" | "income" | "transfer" };

export function parseAmount(raw: string): number {
  let s = String(raw ?? "").replace(/[\s\u00a0]/g, "").replace(/kr|sek|−/gi, (m) => (m === "−" ? "-" : ""));
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function parseDate(raw: string): string | null {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function splitCsv(text: string): string[][] {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0];
  const delim = [";", "\t", ","].sort((a, b) => head.split(b).length - head.split(a).length)[0];
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === delim && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  });
}

export function detectBank(header: string[], fileName = ""): Bank {
  const h = header.join("|").toLowerCase();
  if (/completed date|started date/.test(h) || /revolut/i.test(fileName)) return "revolut";
  if (/bokföringsdatum|verifikationsnummer|text\/mottagare/.test(h) || /seb/i.test(fileName)) return "seb";
  return "okänd";
}

const col = (header: string[], ...names: RegExp[]) => {
  for (const re of names) {
    const i = header.findIndex((h) => re.test(h.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
};

/** Tolkar en tabell (CSV eller Excel-blad) till rader. */
export function parseTable(table: string[][], fileName = ""): { bank: Bank; rows: StatementRow[] } {
  const headerIdx = table.findIndex((r) => r.some((c) => /datum|date/i.test(c)) && r.some((c) => /belopp|amount/i.test(c)));
  if (headerIdx < 0) return { bank: "okänd", rows: [] };
  const header = table[headerIdx];
  const bank = detectBank(header, fileName);
  const dateI = col(header, /completed date/, /bokföringsdatum/, /transaktionsdatum/, /datum|date/);
  const amountI = col(header, /^amount$/, /^belopp/, /belopp|amount/);
  const textI = col(header, /description/, /text\/mottagare/, /text|beskrivning|mottagare|meddelande/);
  const feeI = bank === "revolut" ? col(header, /^fee$/) : -1;
  const stateI = bank === "revolut" ? col(header, /^state$/) : -1;
  const rows: StatementRow[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    if (stateI >= 0 && r[stateI] && !/completed|slutförd/i.test(r[stateI])) continue;
    const date = parseDate(r[dateI] ?? "");
    let amount = parseAmount(r[amountI] ?? "");
    if (feeI >= 0) { const fee = parseAmount(r[feeI] ?? "0"); if (Number.isFinite(fee)) amount -= fee; }
    if (!date || !Number.isFinite(amount) || amount === 0) continue;
    rows.push({ date, amount: Math.round(amount * 100) / 100, text: (r[textI] ?? "").slice(0, 200) });
  }
  return { bank, rows };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, "");
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/** Liknar texterna varandra (ena innehåller den andra eller delar ett ord ≥4 tecken)? */
export function textsSimilar(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const words = (s: string) => s.toLowerCase().split(/[^a-zåäö0-9]+/).filter((w) => w.length >= 4);
  const wb = new Set(words(b));
  return words(a).some((w) => wb.has(w));
}

export type DupResult = "exakt" | "möjlig" | null;
/** Dubblettkoll: samma belopp inom ±2 dagar. Exakt om samma dag och liknande text. */
export function findDuplicate(row: StatementRow, existing: ExistingRow[]): DupResult {
  let result: DupResult = null;
  for (const e of existing) {
    if (Math.abs(Math.abs(e.amount) - Math.abs(row.amount)) > 0.009) continue;
    const d = dayDiff(e.date, row.date);
    if (d > 2) continue;
    const similar = textsSimilar(row.text, e.text);
    if (similar && d <= 2) return "exakt";
    result = "möjlig";
  }
  return result;
}

/** Hittar en motsvarande överföring (motsatt tecken, samma belopp, ±3 dagar). */
export function findTransferPair(
  row: StatementRow,
  transfers: { date: string; amount: number }[],
): boolean {
  return transfers.some((t) => Math.abs(t.amount - Math.abs(row.amount)) < 0.01 && dayDiff(t.date, row.date) <= 3);
}

export const AUTO_SAVE_CONFIDENCE = 0.85;
export function shouldAutoSave(confidence: number, dup: DupResult): boolean {
  return dup === null && confidence >= AUTO_SAVE_CONFIDENCE;
}

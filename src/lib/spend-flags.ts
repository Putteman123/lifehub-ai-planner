import type { SpendRow } from "./finance";

/**
 * Röda flaggor på en utgiftsrad – saker som är värda en extra blick:
 * dubbletter, ovanligt stora belopp, saknad kategori/konto, sena köp
 * och tobaksutgifter som drar iväg.
 */
export type SpendFlag = {
  id: string;
  label: string;
  /** "hog" = röd, "medel" = amber. */
  level: "hog" | "medel";
  hint: string;
};

const DAY = 86_400_000;

function amountOf(row: SpendRow) {
  return Math.abs(Number(row.amount) || 0);
}

function isTobacco(row: SpendRow) {
  const text = `${row.category ?? ""} ${row.note ?? ""}`.toLowerCase();
  return /cigarett|snus|tobak/.test(text);
}

/** Medianbelopp bland utgifterna – tåligare mot enstaka stora köp. */
function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function spendFlags(row: SpendRow, all: SpendRow[]): SpendFlag[] {
  const flags: SpendFlag[] = [];
  const amount = amountOf(row);
  const time = new Date(row.spent_at).getTime();

  // 1. Trolig dubbelregistrering: samma belopp inom tre timmar.
  const duplicate = all.some(
    (other) =>
      other.id !== row.id &&
      Math.abs(amountOf(other) - amount) < 0.01 &&
      Math.abs(new Date(other.spent_at).getTime() - time) <= 3 * 3_600_000,
  );
  if (duplicate) {
    flags.push({
      id: "dubblett",
      label: "Möjlig dubblett",
      level: "hog",
      hint: "Samma belopp registrerat inom tre timmar.",
    });
  }

  // 2. Ovanligt stort köp jämfört med din vanliga nivå.
  const typical = median(all.map(amountOf).filter((v) => v > 0));
  if (typical > 0 && amount >= typical * 5 && amount >= 500) {
    flags.push({
      id: "stort",
      label: "Ovanligt stort",
      level: "hog",
      hint: `Ungefär ${Math.round(amount / typical)}× din vanliga utgift.`,
    });
  }

  // 3. Saknar konto – då stämmer inte saldot.
  if (!row.account_id) {
    flags.push({
      id: "konto",
      label: "Inget konto",
      level: "medel",
      hint: "Utgiften dras inte från något saldo.",
    });
  }

  // 4. Saknar kategori – hamnar utanför tårtdiagrammet.
  if (!row.category?.trim()) {
    flags.push({
      id: "kategori",
      label: "Okategoriserad",
      level: "medel",
      hint: "Syns inte i utgiftsfördelningen.",
    });
  }

  // 5. Saknar beskrivning.
  if (!row.note?.trim()) {
    flags.push({
      id: "text",
      label: "Utan text",
      level: "medel",
      hint: "Svår att känna igen i efterhand.",
    });
  }

  // 6. Nattköp – ofta impulsköp eller felregistrering.
  const hour = Number(
    new Date(row.spent_at).toLocaleString("sv-SE", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (hour >= 1 && hour < 5) {
    flags.push({
      id: "natt",
      label: "Nattköp",
      level: "medel",
      hint: `Registrerat kl ${String(hour).padStart(2, "0")}.`,
    });
  }

  // 7. Tobak flera gånger samma dag.
  if (isTobacco(row)) {
    const sameDay = all.filter(
      (other) =>
        isTobacco(other) &&
        new Date(other.spent_at).toDateString() === new Date(row.spent_at).toDateString(),
    );
    if (sameDay.length >= 3) {
      flags.push({
        id: "tobak",
        label: `Tobak ×${sameDay.length}`,
        level: "hog",
        hint: `${Math.round(sameDay.reduce((sum, s) => sum + amountOf(s), 0))} kr på tobak samma dag.`,
      });
    }
  }

  // 8. Framtida datum – nästan alltid ett skrivfel.
  if (time > Date.now() + DAY) {
    flags.push({
      id: "framtid",
      label: "Datum i framtiden",
      level: "hog",
      hint: "Kontrollera datumet på utgiften.",
    });
  }

  return flags;
}

import { describe, expect, it } from "vitest";
import { findDuplicate, findTransferPair, parseTable, shouldAutoSave, splitCsv } from "./statement-parse";

describe("kontoutdrag", () => {
  it("tolkar SEB-export", () => {
    const csv = "Bokföringsdatum;Valutadatum;Verifikationsnummer;Text/mottagare;Belopp;Saldo\n2026-11-02;2026-11-02;123;ICA KVANTUM;-245,50;10 000,00";
    const r = parseTable(splitCsv(csv));
    expect(r.bank).toBe("seb");
    expect(r.rows).toEqual([{ date: "2026-11-02", amount: -245.5, text: "ICA KVANTUM" }]);
  });
  it("tolkar Revolut-export och hoppar över ej slutförda", () => {
    const csv = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-11-03 10:00,2026-11-03 11:00,Spotify,-119.00,0.00,SEK,COMPLETED,500\nTOPUP,Current,2026-11-04,,Top-up,500,0,SEK,PENDING,1000";
    const r = parseTable(splitCsv(csv));
    expect(r.bank).toBe("revolut");
    expect(r.rows).toEqual([{ date: "2026-11-03", amount: -119, text: "Spotify" }]);
  });
  it("känner igen dubblett inom två dagar med liknande text", () => {
    expect(findDuplicate({ date: "2026-11-03", amount: -119, text: "Spotify AB" }, [{ date: "2026-11-02", amount: -119, text: "spotify", kind: "spend" }])).toBe("exakt");
    expect(findDuplicate({ date: "2026-11-03", amount: -119, text: "Spotify" }, [{ date: "2026-11-08", amount: -119, text: "Spotify", kind: "spend" }])).toBeNull();
  });
  it("parar ihop SEB->Revolut-överföring inom tre dagar", () => {
    expect(findTransferPair({ date: "2026-11-05", amount: 500, text: "Top-up" }, [{ date: "2026-11-04", amount: 500 }])).toBe(true);
    expect(findTransferPair({ date: "2026-11-05", amount: 500, text: "Top-up" }, [{ date: "2026-11-01", amount: 500 }])).toBe(false);
  });
  it("autosparar bara säkra nya rader (≥0,85)", () => {
    expect(shouldAutoSave(0.85, null)).toBe(true);
    expect(shouldAutoSave(0.84, null)).toBe(false);
    expect(shouldAutoSave(0.99, "möjlig")).toBe(false);
  });
});

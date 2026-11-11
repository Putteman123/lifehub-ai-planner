import { afterEach, describe, expect, it, vi } from "vitest";

import { logAiError, logAiSuccess } from "./ai-logger.server";

type Logged = {
  level: string;
  event: string;
  provider: string;
  feature: string;
  status: number | null;
  errorType: string;
  duration: string;
  message: string;
  timestamp: string;
};

function parse(line: unknown): Logged {
  return JSON.parse(String(line)) as Logged;
}

function lastWarn(): Logged {
  const call = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return parse(call.at(-1)?.[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AI-loggning", () => {
  it("kategoriserar slutna krediter som quota", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    logAiError({
      provider: "perplexity",
      feature: "kontoutdrag",
      status: 402,
      error: new Error("HTTP 402: AI-krediterna är slut"),
    });
    const entry = lastWarn();
    expect(entry.event).toBe("ai_call_failed");
    expect(entry.provider).toBe("perplexity");
    expect(entry.feature).toBe("kontoutdrag");
    expect(entry.status).toBe(402);
    expect(entry.errorType).toBe("quota");
  });

  it("kategoriserar nätverksfel som network", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    logAiError({ provider: "google", feature: "chatt", error: new TypeError("fetch failed") });
    expect(lastWarn().errorType).toBe("network");
  });

  it("kategoriserar 429 som rate_limit och 403 som forbidden", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    logAiError({ provider: "lovable", feature: "text", error: new Error("HTTP 429: busy") });
    expect(lastWarn().errorType).toBe("rate_limit");
    logAiError({ provider: "lovable", feature: "text", error: new Error("HTTP 403: blocked") });
    expect(lastWarn().errorType).toBe("forbidden");
  });

  it("klipper långa felmeddelanden till 300 tecken och döljer okända fel", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    logAiError({ provider: "openai", feature: "text", error: new Error("x".repeat(400)) });
    expect(lastWarn().message.length).toBe(300);
    logAiError({ provider: "openai", feature: "text", error: { code: 7 } });
    const entry = lastWarn();
    expect(entry.message).toBe("Okänt fel");
    expect(entry.errorType).toBe("unknown");
    expect(entry.status).toBeNull();
  });

  it("loggade lyckade anrop med faktisk tid", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logAiSuccess({ provider: "perplexity", feature: "veckoplan", durationMs: 123 });
    const entry = parse(info.mock.calls.at(-1)?.[0]);
    expect(entry.event).toBe("ai_call_success");
    expect(entry.provider).toBe("perplexity");
    expect(entry.feature).toBe("veckoplan");
    expect(entry.duration).toBe("123ms");
  });
});

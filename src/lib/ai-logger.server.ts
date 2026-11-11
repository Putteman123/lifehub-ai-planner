export type AiProvider = "openai" | "google" | "perplexity" | "lovable";

export type AiLogContext = {
  provider: AiProvider;
  feature: string;
  status?: number;
  durationMs?: number;
  error?: unknown;
};

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  if (typeof error === "string") return error.slice(0, 300);
  return "Okänt fel";
}

function errorType(error: unknown): string {
  if (error instanceof TypeError) return "network";
  if (error instanceof Error) {
    if (error.message.includes("401")) return "auth";
    if (error.message.includes("402")) return "quota";
    if (error.message.includes("403")) return "forbidden";
    if (error.message.includes("429")) return "rate_limit";
    if (error.message.includes("5")) return "server";
  }
  return "unknown";
}

export function logAiError(context: AiLogContext): void {
  const { provider, feature, status, durationMs, error } = context;
  const type = errorType(error);
  const message = safeMessage(error);
  const duration = durationMs ? `${durationMs}ms` : "okänd";

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "ai_call_failed",
      provider,
      feature,
      status: status ?? null,
      errorType: type,
      duration,
      message,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function logAiSuccess(context: AiLogContext): void {
  const { provider, feature, durationMs } = context;
  console.info(
    JSON.stringify({
      level: "info",
      event: "ai_call_success",
      provider,
      feature,
      duration: durationMs ? `${durationMs}ms` : "okänd",
      timestamp: new Date().toISOString(),
    }),
  );
}

import { describe, expect, it, vi } from "vitest";

import {
  aggregateAiUsage,
  loadAiUsageOverview,
  recordDeliveredAiResponse,
  type AiUsageEvent,
} from "./ai-usage.server";

const event = (provider: AiUsageEvent["provider"], created_at: string): AiUsageEvent => ({
  provider,
  feature: "test",
  created_at,
});

function context(owner: unknown, rows: AiUsageEvent[] = [], rpcError: unknown = null) {
  const gte = vi.fn(async () => ({ data: rows, error: null }));
  const select = vi.fn(() => ({ gte }));
  const from = vi.fn(() => ({ select }));
  return {
    ctx: {
      userId: "user-1",
      supabase: { rpc: vi.fn(async () => ({ data: owner, error: rpcError })), from },
    },
    from,
  };
}

describe("AI-förbrukning", () => {
  it("summerar idag, vecka och månad för alla leverantörer", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    const result = aggregateAiUsage([
      event("google", "2026-10-01T08:00:00Z"),
      event("lovable", "2026-09-30T08:00:00Z"),
      event("openai", "2026-09-28T08:00:00Z"),
      event("perplexity", "2026-09-27T08:00:00Z"),
    ], now);
    expect(result.today.providers.google).toBe(1);
    expect(result.week.total).toBe(3);
    expect(result.month.total).toBe(1);
  });

  it("returnerar ett ärligt tomt läge", () => {
    const result = aggregateAiUsage([], new Date("2026-10-01T10:00:00Z"));
    expect(result.month.total).toBe(0);
    expect(result.trackingStartedAt).toBeNull();
  });

  it("registrerar ett levererat svar exakt en gång med rätt leverantör", async () => {
    const recorder = vi.fn(async () => undefined);
    await expect(recordDeliveredAiResponse("perplexity", "day-brief", recorder)).resolves.toBe("perplexity");
    expect(recorder).toHaveBeenCalledOnce();
    expect(recorder).toHaveBeenCalledWith("perplexity", "day-brief");
  });

  it("låter strikt superadmin läsa data", async () => {
    const { ctx, from } = context(true, [event("google", "2026-10-01T08:00:00Z")]);
    const result = await loadAiUsageOverview(ctx, new Date("2026-10-01T10:00:00Z"));
    expect(result.today.total).toBe(1);
    expect(from).toHaveBeenCalledWith("ai_usage_events");
  });

  for (const [label, owner, error] of [
    ["false", false, null],
    ["null", null, null],
    ["RPC-fel", true, { message: "nej" }],
  ] as const) {
    it(`nekar ${label} före dataläsning`, async () => {
      const { ctx, from } = context(owner, [], error);
      await expect(loadAiUsageOverview(ctx, new Date())).rejects.toThrow(/superadmin/);
      expect(from).not.toHaveBeenCalled();
    });
  }
});
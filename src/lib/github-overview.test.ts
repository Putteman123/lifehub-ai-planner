import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetGithubCache, loadGithubOverview, safeGithubUrl } from "./github-overview.server";

const ctx = (rpc: () => Promise<{ data: unknown; error: unknown }>) => ({ supabase: { rpc: vi.fn(rpc) }, userId: "u1" });

function okFetch(runs: unknown[] = []) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    expect(u.startsWith("https://api.github.com/repos/Putteman123/lifehub-ai-planner")).toBe(true);
    let body: unknown = [];
    if (u.endsWith("/lifehub-ai-planner")) body = { full_name: "Putteman123/lifehub-ai-planner", html_url: "https://github.com/Putteman123/lifehub-ai-planner", default_branch: "main" };
    else if (u.includes("/actions/runs")) body = { workflow_runs: runs };
    else if (u.includes("/commits")) body = [{ sha: "abcdef123", html_url: "https://github.com/x", commit: { message: "Hej\nmer", author: { name: "P", date: "2026-09-30" } } }];
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

beforeEach(() => __resetGithubCache());

describe("GitHub-översikt", () => {
  it("godkänd superadmin får data och tom Actions-lista", async () => {
    const f = okFetch();
    const d = await loadGithubOverview(ctx(async () => ({ data: true, error: null })), { fetchImpl: f });
    expect(d.repo.defaultBranch).toBe("main");
    expect(d.runs).toEqual([]);
    expect(d.commits[0]!.title).toBe("Hej");
    expect(f).toHaveBeenCalledTimes(5);
  });

  for (const [name, rpc] of [
    ["vanlig användare (false)", async () => ({ data: false, error: null })],
    ["null", async () => ({ data: null, error: null })],
    ["RPC-fel", async () => ({ data: true, error: { message: "x" } })],
    ["truthy icke-true", async () => ({ data: "true", error: null })],
    ["rpc kastar", async () => { throw new Error("boom"); }],
  ] as const) {
    it(`nekar ${name} utan fetch och utan cache`, async () => {
      // Fyll cachen som superadmin först.
      await loadGithubOverview(ctx(async () => ({ data: true, error: null })), { fetchImpl: okFetch() });
      const f = okFetch();
      await expect(loadGithubOverview(ctx(rpc as never), { fetchImpl: f })).rejects.toThrow(/superadmin/);
      expect(f).not.toHaveBeenCalled();
    });
  }

  it("returnerar cache utan ny fetch inom cachetiden", async () => {
    const c = ctx(async () => ({ data: true, error: null }));
    const f = okFetch();
    await loadGithubOverview(c, { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(5);
    const f2 = okFetch();
    const d = await loadGithubOverview(c, { fetchImpl: f2 });
    expect(d.repo.defaultBranch).toBe("main");
    expect(f2).not.toHaveBeenCalled();
  });

  it("force:true hämtar på nytt trots färsk cache", async () => {
    const c = ctx(async () => ({ data: true, error: null }));
    await loadGithubOverview(c, { fetchImpl: okFetch() });
    const f2 = okFetch();
    const d = await loadGithubOverview(c, { force: true, fetchImpl: f2 });
    expect(d.repo.fullName).toBe("Putteman123/lifehub-ai-planner");
    expect(f2).toHaveBeenCalledTimes(5);
  });

  it("safeGithubUrl avvisar osäkra protokoll och värdar", () => {
    const fallback = "https://github.com/Putteman123/lifehub-ai-planner";
    expect(safeGithubUrl("javascript:alert(1)")).toBe(fallback);
    expect(safeGithubUrl("http://github.com/x")).toBe(fallback);
    expect(safeGithubUrl("https://evil.com/x")).toBe(fallback);
    expect(safeGithubUrl("https://github.com.evil.com/x")).toBe(fallback);
    expect(safeGithubUrl(123)).toBe(fallback);
    expect(safeGithubUrl("https://github.com/Putteman123/lifehub-ai-planner")).toBe(fallback);
  });

  it("visar läsbart fel vid rate limit", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } })) as unknown as typeof fetch;
    await expect(loadGithubOverview(ctx(async () => ({ data: true, error: null })), { fetchImpl: f })).rejects.toThrow(/gräns/);
  });

  it("visar läsbart fel när API:t är otillgängligt", async () => {
    const f = vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch;
    await expect(loadGithubOverview(ctx(async () => ({ data: true, error: null })), { fetchImpl: f })).rejects.toThrow(/svarar inte/);
  });
});

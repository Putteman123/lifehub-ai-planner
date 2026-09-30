/** Skrivskyddad GitHub-översikt för superadmin. Repo och värd är låsta på servern. */

export const GITHUB_OWNER = "Putteman123";
export const GITHUB_REPO = "lifehub-ai-planner";
export const GITHUB_BRANCH = "main";
const API = "https://api.github.com";
const TIMEOUT_MS = 6000;
const CACHE_MS = 60_000;

export type GhItem = { id: string; title: string; url: string; meta: string; date: string | null };
export type GithubOverview = {
  repo: { fullName: string; url: string; defaultBranch: string; description: string | null; private: boolean };
  commits: GhItem[];
  issues: GhItem[];
  pulls: GhItem[];
  runs: GhItem[];
  fetchedAt: string;
};

type OwnerCtx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }; userId: string };

let cache: { at: number; data: GithubOverview } | null = null;
export function __resetGithubCache() {
  cache = null;
}

/** Strikt: endast data === true och inget fel godkänns. */
export async function assertAppOwner(ctx: OwnerCtx): Promise<void> {
  let res: { data: unknown; error: unknown };
  try {
    res = await ctx.supabase.rpc("is_app_owner", { _user_id: ctx.userId });
  } catch {
    throw new Error("Endast superadmin har åtkomst.");
  }
  if (res.error || res.data !== true) throw new Error("Endast superadmin har åtkomst.");
}

/** Tillåt bara https-länkar till github.com. */
export function safeGithubUrl(u: unknown): string {
  if (typeof u !== "string") return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
  try {
    const p = new URL(u);
    if (p.protocol === "https:" && p.hostname === "github.com") return p.toString();
  } catch {
    /* ignore */
  }
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
}

async function ghGet(fetchImpl: typeof fetch, path: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`, {
      method: "GET",
      headers: { Accept: "application/vnd.github+json", "User-Agent": "lifeflow-ai-readonly", "X-GitHub-Api-Version": "2022-11-28" },
      signal: ctrl.signal,
    });
  } catch {
    throw new Error("GitHub svarar inte just nu. Försök igen om en stund.");
  } finally {
    clearTimeout(t);
  }
  if (res.ok) return res.json();
  if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHubs gräns för anrop är nådd. Försök igen om en stund.");
  }
  if (res.status === 404) throw new Error("Repot hittades inte – det kan ha blivit privat.");
  throw new Error(`GitHub svarade med fel (${res.status}).`);
}

export async function loadGithubOverview(
  ctx: OwnerCtx,
  opts: { force?: boolean; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<GithubOverview> {
  await assertAppOwner(ctx); // före cache och före fetch
  const now = opts.now ?? Date.now;
  if (!opts.force && cache && now() - cache.at < CACHE_MS) return cache.data;
  const f = opts.fetchImpl ?? fetch;

  const [repo, commits, issues, pulls, runs] = await Promise.all([
    ghGet(f, ""),
    ghGet(f, `/commits?sha=${GITHUB_BRANCH}&per_page=10`),
    ghGet(f, `/issues?state=open&per_page=20`),
    ghGet(f, `/pulls?state=open&per_page=10`),
    ghGet(f, `/actions/runs?per_page=10`),
  ]);

  const data: GithubOverview = {
    repo: {
      fullName: String(repo?.full_name ?? `${GITHUB_OWNER}/${GITHUB_REPO}`),
      url: safeGithubUrl(repo?.html_url),
      defaultBranch: String(repo?.default_branch ?? GITHUB_BRANCH),
      description: typeof repo?.description === "string" ? repo.description : null,
      private: repo?.private === true,
    },
    commits: (Array.isArray(commits) ? commits : []).map((c: any) => ({
      id: String(c.sha ?? "").slice(0, 7),
      title: String(c.commit?.message ?? "").split("\n")[0] ?? "",
      url: safeGithubUrl(c.html_url),
      meta: String(c.commit?.author?.name ?? ""),
      date: c.commit?.author?.date ?? null,
    })),
    issues: (Array.isArray(issues) ? issues : [])
      .filter((i: any) => !i.pull_request)
      .map((i: any) => ({ id: `#${i.number}`, title: String(i.title ?? ""), url: safeGithubUrl(i.html_url), meta: String(i.user?.login ?? ""), date: i.created_at ?? null })),
    pulls: (Array.isArray(pulls) ? pulls : []).map((p: any) => ({
      id: `#${p.number}`, title: String(p.title ?? ""), url: safeGithubUrl(p.html_url), meta: String(p.user?.login ?? ""), date: p.created_at ?? null,
    })),
    runs: (Array.isArray(runs?.workflow_runs) ? runs.workflow_runs : []).map((r: any) => ({
      id: String(r.id), title: String(r.name ?? r.display_title ?? "Körning"), url: safeGithubUrl(r.html_url),
      meta: `${r.conclusion ?? r.status ?? ""} · ${r.head_branch ?? ""}`, date: r.created_at ?? null,
    })),
    fetchedAt: new Date(now()).toISOString(),
  };
  cache = { at: now(), data };
  return data;
}

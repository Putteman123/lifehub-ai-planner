import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const ROOT_DOMAINS = ["mellberg.online", "livo.health"];
/** Domän där vårdens landningssida är startsida. */
const CARE_DOMAIN = "livo.health";
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "notify", "mail", "id-preview"]);
const PASSTHROUGH_PREFIXES = [
  "/api",
  "/_",
  "/assets",
  "/favicon",
  "/manifest",
  "/sw.js",
  "/v/f/",
  "/auth",
  "/demo",
  "/invite",
  "/mcp",
  "/.well-known",
  "/.lovable",
  "/lovable",
  "/.mcp",
];

function isPassthrough(pathname: string): boolean {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

/**
 * livo.health (och www) visar vårdens landningssida,
 * <kortnamn>.<domän> visar företagsvyn på /v/f/<kortnamn>.
 */
function rewriteHost(request: Request): Request {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (host === CARE_DOMAIN || host === `www.${CARE_DOMAIN}`) {
    if (url.pathname !== "/") return request;
    url.pathname = "/vard";
    return new Request(url, request);
  }

  const root = ROOT_DOMAINS.find((d) => host.endsWith(`.${d}`));
  if (!root) return request;

  const slug = host.slice(0, -1 * (root.length + 1));
  if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) return request;
  if (!/^[a-z0-9-]+$/.test(slug)) return request;
  if (isPassthrough(url.pathname)) return request;

  const rest = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `/v/f/${slug}${rest}`;
  return new Request(url, request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(rewriteHost(request), env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

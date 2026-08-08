import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Endast läsning mot juristappen "Apples" (PM Juridik). Andrea får slå upp
 * ärenden, klienter, dokument och deadlines där – men skriver aldrig något.
 */

function applesClient(): SupabaseClient | null {
  const url = process.env["APPLES_SUPABASE_URL"];
  const key = process.env["APPLES_SUPABASE_KEY"];
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Opaka sb_-nycklar är inte JWT:er – skicka bara apikey.
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const MISSING =
  "Kopplingen till juristappen är inte konfigurerad ännu (backend-adress och nyckel saknas).";

type Result = { ok: boolean; message: string; rows: unknown[] };

function empty(message: string): Result {
  return { ok: false, message, rows: [] };
}

/** Söker ärenden på titel, ärendenummer eller klientnamn. */
export async function searchCases(query: string, limit = 10): Promise<Result> {
  const client = applesClient();
  if (!client) return empty(MISSING);

  const term = query.trim().replace(/[%,]/g, " ");
  let request = client
    .from("cases")
    .select("id, case_number, title, client_name, status, category, description, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (term) {
    request = request.or(
      `title.ilike.%${term}%,case_number.ilike.%${term}%,client_name.ilike.%${term}%`,
    );
  }

  const { data, error } = await request;
  if (error) return empty(`Juristappen svarade: ${error.message}`);
  return { ok: true, message: `${data?.length ?? 0} ärenden.`, rows: data ?? [] };
}

/** Hämtar ett ärende med sakomständigheter och senaste dokument. */
export async function getCase(caseId: string): Promise<Result> {
  const client = applesClient();
  if (!client) return empty(MISSING);

  const { data, error } = await client
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (error) return empty(`Juristappen svarade: ${error.message}`);
  if (!data) return empty("Ärendet hittades inte i juristappen.");

  const docs = await client
    .from("case_documents")
    .select("id, title, ai_category, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    ok: true,
    message: "Ärendet hämtat.",
    rows: [{ ...data, documents: docs.data ?? [] }],
  };
}

/** Söker klienter på namn, klientkod eller e-post. */
export async function searchClients(query: string, limit = 10): Promise<Result> {
  const client = applesClient();
  if (!client) return empty(MISSING);

  const term = query.trim().replace(/[%,]/g, " ");
  let request = client
    .from("clients")
    .select("id, client_code, full_name, email, phone, city, notes")
    .is("deleted_at", null)
    .limit(limit);
  if (term) {
    request = request.or(
      `full_name.ilike.%${term}%,client_code.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, error } = await request;
  if (error) return empty(`Juristappen svarade: ${error.message}`);
  return { ok: true, message: `${data?.length ?? 0} klienter.`, rows: data ?? [] };
}

/** Söker dokument i juristappen på titel. */
export async function searchDocuments(query: string, limit = 10): Promise<Result> {
  const client = applesClient();
  if (!client) return empty(MISSING);

  const term = query.trim().replace(/[%,]/g, " ");
  let request = client
    .from("case_documents")
    .select("id, case_id, title, ai_category, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (term) request = request.ilike("title", `%${term}%`);

  const { data, error } = await request;
  if (error) return empty(`Juristappen svarade: ${error.message}`);
  return { ok: true, message: `${data?.length ?? 0} dokument.`, rows: data ?? [] };
}

/** Kommande deadlines och förhandlingar i juristappen. */
export async function upcomingDeadlines(days = 30): Promise<Result> {
  const client = applesClient();
  if (!client) return empty(MISSING);

  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);

  const { data, error } = await client
    .from("case_calendar_events")
    .select("*")
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time")
    .limit(50);
  if (error) return empty(`Juristappen svarade: ${error.message}`);
  return {
    ok: true,
    message: `${data?.length ?? 0} kommande poster i juristkalendern.`,
    rows: data ?? [],
  };
}

/** Är kopplingen konfigurerad? */
export function applesConfigured() {
  return Boolean(process.env["APPLES_SUPABASE_URL"] && process.env["APPLES_SUPABASE_KEY"]);
}

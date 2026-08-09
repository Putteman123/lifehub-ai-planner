import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Endast läsning mot juristappen "Apples" (PM Juridik). Andrea får slå upp
 * ärenden, klienter, dokument och deadlines där – men skriver aldrig något.
 */

const MISSING =
  "Kopplingen till juristappen är inte konfigurerad ännu (backend-adress och nyckel saknas).";

const SIGNIN_FAILED =
  "Kopplingen till juristappen kunde inte logga in. Kontrollera inloggningsuppgifterna.";

type Result = { ok: boolean; message: string; rows: unknown[] };

function empty(message: string): Result {
  return { ok: false, message, rows: [] };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getApplesToken(): Promise<string | null> {
  const url = process.env["APPLES_SUPABASE_URL"];
  const key = process.env["APPLES_SUPABASE_KEY"];
  const email = process.env["APPLES_SUPABASE_EMAIL"];
  const password = process.env["APPLES_SUPABASE_PASSWORD"];
  if (!url || !key) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  // Om inloggningsuppgifter finns, logga in och använd användarens access token.
  if (email && password) {
    const signInClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      console.error("Apples inloggning misslyckades:", error?.message);
      cachedToken = null;
      return null;
    }
    const expiresAt = (data.session.expires_at ?? now / 1000 + 3600) * 1000;
    cachedToken = { token: data.session.access_token, expiresAt };
    return data.session.access_token;
  }

  // Om nyckeln ser ut som en JWT, använd den direkt.
  if (key.split(".").length === 3) return key;

  return null;
}

async function applesClientOrError(): Promise<{ client: SupabaseClient } | { error: string }> {
  const url = process.env["APPLES_SUPABASE_URL"];
  const key = process.env["APPLES_SUPABASE_KEY"];
  if (!url || !key) return { error: MISSING };

  const token = await getApplesToken();
  if (!token) {
    if (process.env["APPLES_SUPABASE_EMAIL"] && process.env["APPLES_SUPABASE_PASSWORD"]) {
      return { error: SIGNIN_FAILED };
    }
    return { error: MISSING };
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.setSession({ access_token: token, refresh_token: "" });
  return { client };
}

/** Söker ärenden på titel, ärendenummer eller klientnamn. */
export async function searchCases(query: string, limit = 10): Promise<Result> {
  const clientOrError = await applesClientOrError();
  if ("error" in clientOrError) return empty(clientOrError.error);
  const client = clientOrError.client;

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
  const clientOrError = await applesClientOrError();
  if ("error" in clientOrError) return empty(clientOrError.error);
  const client = clientOrError.client;

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
  const clientOrError = await applesClientOrError();
  if ("error" in clientOrError) return empty(clientOrError.error);
  const client = clientOrError.client;

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
  const clientOrError = await applesClientOrError();
  if ("error" in clientOrError) return empty(clientOrError.error);
  const client = clientOrError.client;

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
  const clientOrError = await applesClientOrError();
  if ("error" in clientOrError) return empty(clientOrError.error);
  const client = clientOrError.client;

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

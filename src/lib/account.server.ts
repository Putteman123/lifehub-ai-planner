import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Alla tabeller där raderna hör till en användare via `user_id`. */
const USER_TABLES = [
  "andrea_memories",
  "andrea_profile",
  "calendars",
  "case_tasks",
  "children",
  "day_segments",
  "event_categories",
  "events",
  "finance_accounts",
  "finance_files",
  "finance_incomes",
  "fixed_expenses",
  "iptv_lines",
  "legal_cases",
  "location_pings",
  "mail_rules",
  "pantry_items",
  "places",
  "reminders",
  "shopping_items",
  "shopping_lists",
  "spend_entries",
  "todos",
  "travel_preferences",
  "vault_credentials",
  "vault_files",
  "vault_items",
  "visit_edits",
  "visits",
] as const;

/** Buckets där filerna ligger i en mapp per användare. */
const BUCKETS = ["andrea", "ekonomi", "kassaskap"] as const;

/** Flyttar filerna i en bucket från gamla användarmappen till den nya. */
async function moveBucketFolder(bucket: string, from: string, to: string) {
  const moves: Array<{ from: string; to: string }> = [];
  const { data: files } = await supabaseAdmin.storage.from(bucket).list(from, { limit: 1000 });
  for (const file of files ?? []) {
    if (!file.name) continue;
    moves.push({ from: `${from}/${file.name}`, to: `${to}/${file.name}` });
  }
  for (const move of moves) {
    await supabaseAdmin.storage.from(bucket).move(move.from, move.to);
  }
  return moves;
}

/**
 * Flyttar all data (databasrader och lagrade filer) från ett konto till ett annat.
 * Returnerar antalet flyttade databasrader.
 */
export async function migrateUserData(fromUserId: string, toUserId: string): Promise<number> {
  let moved = 0;

  for (const table of USER_TABLES) {
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (
            c: string,
            v: string,
          ) => {
            select: (
              c: string,
            ) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await client
      .from(table)
      .update({ user_id: toUserId })
      .eq("user_id", fromUserId)
      .select("id");
    if (error) {
      console.error(`Kunde inte flytta ${table}:`, error.message);
      continue;
    }
    moved += data?.length ?? 0;
  }


  // Profiles har användarens id som primärnyckel – ingen flytt, bara städning.
  for (const bucket of BUCKETS) {
    try {
      await moveBucketFolder(bucket, fromUserId, toUserId);
    } catch (error) {
      console.error(`Kunde inte flytta filer i ${bucket}:`, error);
    }
  }

  // Lagringssökvägar i databasen pekar på den gamla mappen – peka om dem.
  for (const table of ["vault_files", "finance_files"] as const) {
    const { data: rows } = await supabaseAdmin
      .from(table)
      .select("id, storage_path")
      .eq("user_id", toUserId);
    for (const row of rows ?? []) {
      if (!row.storage_path?.startsWith(`${fromUserId}/`)) continue;
      await supabaseAdmin
        .from(table)
        .update({ storage_path: row.storage_path.replace(`${fromUserId}/`, `${toUserId}/`) })
        .eq("id", row.id);
    }
  }

  return moved;
}

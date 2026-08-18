/**
 * Filer som Patrick laddar upp till Andrea i chatten. Filen ligger i den
 * privata lagringsplatsen "andrea" och kopieras därifrån vidare när Patrick
 * bekräftat vart den ska.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Ok = { ok: true; message: string };

function ok(message: string): Ok {
  return { ok: true, message };
}

function guardPath(userId: string, path: string) {
  const clean = path.replace(/^andrea\//, "").trim();
  if (!clean.startsWith(`${userId}/`)) {
    throw new Error("Filen hör inte till dig.");
  }
  return clean;
}

async function readFile(userId: string, storagePath: string) {
  const path = guardPath(userId, storagePath);
  const { data, error } = await supabaseAdmin.storage.from("andrea").download(path);
  if (error || !data) throw new Error(error?.message ?? "Kunde inte läsa filen.");
  const buffer = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return {
    path,
    bytes: buffer.length,
    base64: btoa(binary),
    mimeType: data.type || "application/octet-stream",
  };
}

/** Kopierar filen till kassaskåpet eller ekonomin och registrerar den. */
export async function saveAttachment(
  userId: string,
  input: {
    storage_path: string;
    file_name: string;
    mime_type?: string | undefined;
    target: "kassaskap" | "ekonomi";
    caption?: string | undefined;
    kind?: string | undefined;
  },
): Promise<Ok> {
  const file = await readFile(userId, input.storage_path);
  const bucket = input.target === "kassaskap" ? "kassaskap" : "ekonomi";
  const name = input.file_name.replace(/[^\w.\-åäöÅÄÖ ]+/g, "_");
  const target = `${userId}/${Date.now()}-${name}`;

  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const upload = await supabaseAdmin.storage
    .from(bucket)
    .upload(target, bytes, { contentType: input.mime_type ?? file.mimeType, upsert: false });
  if (upload.error) throw new Error(upload.error.message);

  if (bucket === "kassaskap") {
    const { error } = await supabaseAdmin.from("vault_files").insert({
      user_id: userId,
      file_name: input.file_name,
      storage_path: target,
      mime_type: input.mime_type ?? file.mimeType,
      size_bytes: file.bytes,
      caption: input.caption ?? null,
    });
    if (error) throw new Error(error.message);
    return ok(`"${input.file_name}" ligger nu i kassaskåpet.`);
  }

  const { error } = await supabaseAdmin.from("finance_files").insert({
    user_id: userId,
    file_name: input.file_name,
    storage_path: target,
    mime_type: input.mime_type ?? file.mimeType,
    size_bytes: file.bytes,
    kind: input.kind ?? "kvitto",
    caption: input.caption ?? null,
  });
  if (error) throw new Error(error.message);
  return ok(`"${input.file_name}" är sparad bland ekonomifilerna.`);
}

/** Läser av ett uppladdat kvitto utan att spara något. */
export async function readAttachmentReceipt(
  userId: string,
  input: { storage_path: string; file_name: string; mime_type?: string | undefined },
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI är inte konfigurerad.");

  const file = await readFile(userId, input.storage_path);
  const mime = input.mime_type ?? file.mimeType;
  const { readReceipt } = await import("./finance-ai.server");
  const { data: categories } = await supabaseAdmin
    .from("spend_entries")
    .select("category")
    .eq("user_id", userId)
    .not("category", "is", null)
    .limit(200);

  const known = Array.from(
    new Set((categories ?? []).map((row) => row.category).filter(Boolean) as string[]),
  );

  return readReceipt({
    apiKey,
    dataUrl: `data:${mime};base64,${file.base64}`,
    mimeType: mime,
    fileName: input.file_name,
    knownCategories: known,
  });
}

/** Lägger varor i skafferiet (utan att röra inköpslistan). */
export async function addPantryItems(userId: string, names: string[]): Promise<Ok> {
  const { canonicalKey, isNonGrocery } = await import("./pantry-name");
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return ok("Inga varor att lägga in.");

  let added = 0;
  for (const raw of clean) {
    if (isNonGrocery(raw)) continue;
    const key = canonicalKey(raw);
    if (!key) continue;
    const existing = await supabaseAdmin
      .from("pantry_items")
      .select("id, times_added")
      .eq("user_id", userId)
      .eq("name_key", key)
      .maybeSingle();
    if (existing.data) {
      await supabaseAdmin
        .from("pantry_items")
        .update({
          times_added: existing.data.times_added + 1,
          last_added_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);
    } else {
      await supabaseAdmin
        .from("pantry_items")
        .insert({ user_id: userId, name: raw, name_key: key, source: "ai" });
    }
    added += 1;
  }
  return ok(`La in ${added} varor i skafferiet.`);
}

/** Markerar butiken på kartan och lägger in köpet i kalendern. */
export async function logReceiptContext(
  userId: string,
  input: {
    merchant: string;
    address?: string | undefined;
    spent_at: string;
    amount?: number | undefined;
    category?: string | undefined;
    add_event?: boolean | undefined;
  },
): Promise<Ok> {
  const when = new Date(input.spent_at);
  if (Number.isNaN(when.getTime())) throw new Error("Kvittot saknar giltigt datum.");
  const messages: string[] = [];

  const { resolveAddressPoint } = await import("./maps.server");
  const query = [input.address, input.merchant].filter(Boolean).join(", ");
  const point =
    (await resolveAddressPoint(query)) ??
    (input.address ? null : await resolveAddressPoint(`${input.merchant}, Sverige`));

  if (point) {
    const dayStart = new Date(when);
    dayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabaseAdmin
      .from("visits")
      .select("id")
      .eq("user_id", userId)
      .eq("label", input.merchant)
      .gte("arrived_at", dayStart.toISOString())
      .lt("arrived_at", new Date(dayStart.getTime() + 86_400_000).toISOString())
      .limit(1);

    if (existing?.length) {
      messages.push("Besöket fanns redan på kartan.");
    } else {
      const { data: places } = await supabaseAdmin
        .from("places")
        .select("*")
        .eq("user_id", userId);
      const { matchPlace } = await import("./geo");
      const place = matchPlace(places ?? [], point.lat, point.lng);
      const { error } = await supabaseAdmin.from("visits").insert({
        user_id: userId,
        place_id: place?.id ?? null,
        label: input.merchant,
        address: point.address,
        lat: point.lat,
        lng: point.lng,
        arrived_at: when.toISOString(),
        left_at: new Date(when.getTime() + 15 * 60_000).toISOString(),
        entry_kind: "besok",
        distance_m: 0,
        travel_mode: "okant",
        source: "kvitto",
        is_manual: false,
        note: input.amount ? `Köp ${Math.round(input.amount)} kr` : null,
      });
      if (error) throw new Error(error.message);
      messages.push(`${input.merchant} är markerad på kartan.`);
    }
  } else {
    messages.push("Hittade ingen adress för butiken.");
  }

  if (input.add_event !== false) {
    const title = `Köp – ${input.merchant}${input.amount ? ` (${Math.round(input.amount)} kr)` : ""}`;
    const dayStart = new Date(when);
    dayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .eq("title", title)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", new Date(dayStart.getTime() + 86_400_000).toISOString())
      .limit(1);
    if (existing?.length) {
      messages.push("Händelsen fanns redan i kalendern.");
    } else {
      const { error } = await supabaseAdmin.from("events").insert({
        user_id: userId,
        title,
        description: input.category ? `Kategori: ${input.category}` : "Skapad från kvitto",
        location: input.address ?? input.merchant,
        starts_at: when.toISOString(),
        ends_at: new Date(when.getTime() + 30 * 60_000).toISOString(),
        all_day: false,
        category: "privat",
      });
      if (error) throw new Error(error.message);
      messages.push("Köpet ligger nu i kalendern.");
    }
  }

  return ok(messages.join(" "));
}

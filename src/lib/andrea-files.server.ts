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

/** En vara att lägga i skafferiet, med valfri prisinformation från kvittot. */
export type PantryLine = {
  name: string;
  amount?: number | null;
  quantity?: string | null;
  is_campaign?: boolean;
};

/** Lägger varor i skafferiet (utan att röra inköpslistan) och sparar prisrader i prisboken. */
export async function addPantryItems(
  userId: string,
  items: PantryLine[],
  context?: { merchant?: string | undefined; purchased_at?: string | undefined },
): Promise<Ok> {
  const { canonicalKey, isNonGrocery } = await import("./pantry-name");
  const clean = items.filter((item) => item.name.trim());
  if (!clean.length) return ok("Inga varor att lägga in.");

  const purchased = context?.purchased_at ?? new Date().toISOString();
  const merchant = context?.merchant?.trim() || null;
  const now = new Date().toISOString();
  const priceRows: Record<string, unknown>[] = [];
  let added = 0;
  for (const item of clean) {
    const raw = item.name.trim();
    if (isNonGrocery(raw)) continue;
    const key = canonicalKey(raw);
    if (!key) continue;
    const existing = await supabaseAdmin
      .from("pantry_items")
      .select("id, times_added")
      .eq("user_id", userId)
      .eq("name_key", key)
      .maybeSingle();
    let pantryId: string | null = null;
    if (existing.data) {
      pantryId = existing.data.id;
      await supabaseAdmin
        .from("pantry_items")
        .update({
          times_added: existing.data.times_added + 1,
          last_added_at: now,
          last_purchased_at: purchased,
        })
        .eq("id", existing.data.id);
    } else {
      const created = await supabaseAdmin
        .from("pantry_items")
        .insert({ user_id: userId, name: raw, name_key: key, source: "ai" })
        .select("id")
        .maybeSingle();
      pantryId = created.data?.id ?? null;
    }
    const price = Number(item.amount);
    if (Number.isFinite(price) && price > 0) {
      priceRows.push({
        user_id: userId,
        pantry_item_id: pantryId,
        name: raw,
        name_key: key,
        merchant,
        price,
        quantity: item.quantity?.trim() || null,
        is_campaign: item.is_campaign === true,
        purchased_at: purchased,
        source: "kvitto",
      });
    }
    added += 1;
  }
  if (priceRows.length) {
    const { error } = await supabaseAdmin.from("pantry_prices").insert(priceRows);
    if (error) throw new Error(error.message);
  }
  return ok(
    `La in ${added} varor i skafferiet${priceRows.length ? ` och sparade ${priceRows.length} priser i prisboken` : ""}.`,
  );
}

/**
 * Slår upp normalpriser i prisboken. Returnerar senaste icke-kampanjpris
 * per matchande vara samt lägsta/högsta noterade normalpris.
 */
export async function lookupPrices(userId: string, query: string): Promise<Ok> {
  const needle = query.trim();
  if (!needle) return ok("Ange en vara att slå upp.");
  const { data, error } = await supabaseAdmin
    .from("pantry_prices")
    .select("name, merchant, price, quantity, is_campaign, purchased_at")
    .eq("user_id", userId)
    .ilike("name", `%${needle}%`)
    .order("purchased_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  if (!data?.length) return ok(`Hittade inga noterade priser på "${needle}" i prisboken.`);

  const byName = new Map<string, typeof data>();
  for (const row of data) {
    const key = row.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }
  const lines = [...byName.entries()].slice(0, 10).map(([name, rows]) => {
    const normal = rows.filter((r) => !r.is_campaign);
    const latest = normal[0] ?? rows[0];
    const prices = normal.map((r) => Number(r.price));
    const span = prices.length > 1 ? ` (lägst ${Math.min(...prices)} kr, högst ${Math.max(...prices)} kr)` : "";
    return `- ${name}: ${latest.price} kr hos ${latest.merchant ?? "okänd butik"} ${String(latest.purchased_at).slice(0, 10)}${span}`;
  });
  return ok(`Prisboken för "${needle}":\n${lines.join("\n")}`);
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

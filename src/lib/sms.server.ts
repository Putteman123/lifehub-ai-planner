/**
 * SMS via iOS Genvägar. Inkommande meddelanden pushas från telefonen till
 * webhooken, utgående läggs i en utkorg som telefonen hämtar och skickar.
 * Endast serverkod får importera den här filen.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SmsRow = {
  id: string;
  direction: "in" | "out";
  contact: string | null;
  phone: string;
  body: string;
  sent_at: string;
  is_read: boolean;
};

/** Normaliserar nummer så att +46 och 07… matchar varandra. */
export function normalizePhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+46")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0046")) return `0${digits.slice(4)}`;
  return digits;
}

/** Sparar ett inkommande (eller redan skickat) SMS. Dubbletter ignoreras. */
export async function ingestSms(
  userId: string,
  input: {
    direction: "in" | "out";
    phone: string;
    contact?: string | null;
    body: string;
    sent_at?: string | null;
    external_id?: string | null;
  },
) {
  const phone = normalizePhone(input.phone);
  const sentAt = input.sent_at ? new Date(input.sent_at).toISOString() : new Date().toISOString();
  const externalId =
    input.external_id?.trim() ||
    `${input.direction}:${phone}:${sentAt}:${input.body.slice(0, 40)}`;

  const { data, error } = await supabaseAdmin
    .from("sms_messages")
    .upsert(
      {
        user_id: userId,
        direction: input.direction,
        phone,
        contact: input.contact?.trim() || null,
        body: input.body,
        sent_at: sentAt,
        external_id: externalId,
        is_read: input.direction === "out",
      },
      { onConflict: "user_id,external_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null, duplicate: !data };
}

/** Söker i SMS-historiken på text, kontakt eller nummer. */
export async function searchSms(
  userId: string,
  input: { query?: string | null; contact?: string | null; limit?: number },
): Promise<SmsRow[]> {
  let q = supabaseAdmin
    .from("sms_messages")
    .select("id, direction, contact, phone, body, sent_at, is_read")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 20, 1), 100));

  const needle = input.contact?.trim() || input.query?.trim();
  if (needle) {
    const escaped = needle.replace(/[%,]/g, " ");
    q = q.or(`body.ilike.%${escaped}%,contact.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SmsRow[];
}

/** Olästa inkommande meddelanden. */
export async function unreadSms(userId: string, limit = 20): Promise<SmsRow[]> {
  const { data, error } = await supabaseAdmin
    .from("sms_messages")
    .select("id, direction, contact, phone, body, sent_at, is_read")
    .eq("user_id", userId)
    .eq("direction", "in")
    .eq("is_read", false)
    .order("sent_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return (data ?? []) as SmsRow[];
}

/** Markerar inkommande meddelanden som lästa. */
export async function markSmsRead(userId: string, ids: string[]) {
  if (ids.length === 0) return { ok: true as const, count: 0 };
  const { error } = await supabaseAdmin
    .from("sms_messages")
    .update({ is_read: true })
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { ok: true as const, count: ids.length };
}

/**
 * Lägger ett godkänt SMS i utkorgen. Anropas först efter att Patrick sagt ja
 * i chatten – verktyget kräver alltid godkännande.
 */
export async function queueSms(
  userId: string,
  input: { phone: string; contact?: string | null; body: string },
) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Telefonnumret saknas.");
  if (!input.body.trim()) throw new Error("Meddelandet är tomt.");

  const { data, error } = await supabaseAdmin
    .from("sms_outbox")
    .insert({
      user_id: userId,
      phone,
      contact: input.contact?.trim() || null,
      body: input.body.trim(),
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return {
    ok: true as const,
    id: data.id,
    message: `SMS till ${input.contact?.trim() || phone} ligger i utkorgen och skickas nästa gång genvägen på iPhone körs.`,
  };
}

/** Hämtar godkända, ej skickade meddelanden åt genvägen på telefonen. */
export async function pendingOutbox(userId: string, limit = 10) {
  const { data, error } = await supabaseAdmin
    .from("sms_outbox")
    .select("id, phone, contact, body")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Telefonen bekräftar att meddelandena är skickade. */
export async function ackOutbox(
  userId: string,
  ids: string[],
  result: { ok: boolean; error?: string | null },
) {
  if (ids.length === 0) return { ok: true as const, count: 0 };
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("sms_outbox")
    .update(
      result.ok
        ? { status: "sent", sent_at: now, error: null }
        : { status: "failed", error: result.error ?? "Genvägen kunde inte skicka meddelandet." },
    )
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  if (result.ok) {
    const { data: rows } = await supabaseAdmin
      .from("sms_outbox")
      .select("id, phone, contact, body, sent_at")
      .in("id", ids);
    for (const row of rows ?? []) {
      await ingestSms(userId, {
        direction: "out",
        phone: row.phone,
        contact: row.contact,
        body: row.body,
        sent_at: row.sent_at ?? now,
        external_id: `outbox:${row.id}`,
      });
    }
  }
  return { ok: true as const, count: ids.length };
}

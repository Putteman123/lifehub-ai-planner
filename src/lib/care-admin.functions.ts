import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gör ett kortnamn (subdomän) av ett företagsnamn. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[éè]/g, "e")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type Ctx = { supabase: any; userId: string };

/** Hämtar organisationen via kortnamn och kontrollerar att användaren får administrera den. */
export async function requireOrg(context: Ctx, slug: string) {
  const { data: org, error } = await context.supabase
    .from("organizations")
    .select("id, name, slug, status, contract_type, seats")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) throw new Error("Verksamheten hittades inte.");

  const { data: canManage } = await context.supabase.rpc("can_manage_org", {
    _org_id: org.id,
    _user_id: context.userId,
  });
  if (canManage !== true) throw new Error("Du har inte behörighet till den här verksamheten.");
  return org as { id: string; name: string; slug: string; status: string; contract_type: string; seats: number | null };
}

const slugInput = z.object({ slug: z.string().min(1).max(60) });

/** Startvy: företaget, dess moduler och räknare. */
export const getAdminOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: modules } = await context.supabase
      .from("org_modules")
      .select("module, enabled")
      .eq("org_id", org.id);
    const { data: members } = await context.supabase
      .from("org_members")
      .select("id, display_name, email, phone, role, is_active, employment, work_hours, notes")
      .eq("org_id", org.id)
      .order("display_name");
    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name, address, phone, is_active, personal_number, door_code")
      .eq("org_id", org.id)
      .order("name");
    const { data: invites } = await context.supabase
      .from("org_invites")
      .select("id, email, display_name, role, status")
      .eq("org_id", org.id)
      .eq("status", "pending");

    return {
      org,
      modules: (modules ?? []).filter((m: { enabled: boolean }) => m.enabled).map((m: { module: string }) => m.module),
      members: members ?? [],
      clients: clients ?? [],
      invites: invites ?? [],
    };
  });

/** Alla verksamheter jag administrerar – används för att hitta rätt kortnamn. */
export const listMyAdminOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ownerFlag } = await context.supabase.rpc("is_app_owner", {
      _user_id: context.userId,
    });
    if (ownerFlag === true) {
      const { data } = await context.supabase
        .from("organizations")
        .select("id, name, slug, status")
        .order("name");
      return data ?? [];
    }
    const { data: members } = await context.supabase
      .from("org_members")
      .select("org_id, organizations(id, name, slug, status)")
      .eq("user_id", context.userId)
      .eq("role", "org_admin")
      .eq("is_active", true);
    return (members ?? [])
      .map((m) => m.organizations as { id: string; name: string; slug: string | null; status: string } | null)
      .filter(Boolean);
  });

/* ---------------- Personal ---------------- */

const staffSchema = z.object({
  slug: z.string().min(1),
  id: z.string().uuid().optional(),
  display_name: z.string().min(2).max(120),
  email: z.string().email().max(160).optional().or(z.literal("")),
  phone: z.string().max(60).optional(),
  role: z.enum(["org_admin", "caregiver"]),
  employment: z.string().max(60).optional(),
  work_hours: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});

const blank = (v?: string) => (v && v.trim().length > 0 ? v.trim() : null);

export const saveStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => staffSchema.parse(d))
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      display_name: data.display_name.trim(),
      email: blank(data.email),
      phone: blank(data.phone),
      role: data.role,
      employment: blank(data.employment),
      work_hours: blank(data.work_hours),
      notes: blank(data.notes),
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("org_members").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("org_members")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Kunde inte spara personalen.");
    return { id: created.id as string };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("org_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Brukare ---------------- */

const clientSchema = z.object({
  slug: z.string().min(1),
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  personal_number: z.string().max(20).optional(),
  address: z.string().max(240).optional(),
  phone: z.string().max(60).optional(),
  door_code: z.string().max(40).optional(),
  key_info: z.string().max(240).optional(),
  notes: z.string().max(4000).optional(),
  is_active: z.boolean().optional(),
});

export const saveClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clientSchema.parse(d))
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      name: data.name.trim(),
      personal_number: blank(data.personal_number),
      address: blank(data.address),
      phone: blank(data.phone),
      door_code: blank(data.door_code),
      key_info: blank(data.key_info),
      notes: blank(data.notes),
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("care_clients").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("care_clients")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Kunde inte spara brukaren.");
    return { id: created.id as string };
  });

export const getClientDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: client } = await context.supabase
      .from("care_clients")
      .select("id, name, personal_number, address, phone, door_code, key_info, notes, is_active")
      .eq("id", data.clientId)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!client) throw new Error("Brukaren hittades inte.");

    const { data: relatives } = await context.supabase
      .from("care_relatives")
      .select("id, name, relation, email, phone, notes, consent")
      .eq("client_id", data.clientId)
      .order("name");
    const { data: medications } = await context.supabase
      .from("care_medications")
      .select("id, name, dose, times, instructions, requires_delegation, is_active")
      .eq("client_id", data.clientId)
      .order("name");
    const { data: visits } = await context.supabase
      .from("care_visits")
      .select("id, title, starts_at, ends_at, staff_id, status")
      .eq("client_id", data.clientId)
      .order("starts_at", { ascending: true })
      .limit(50);

    const medIds = (medications ?? []).map((m: { id: string }) => m.id);
    let events: unknown[] = [];
    if (medIds.length > 0) {
      const { data: rows } = await context.supabase
        .from("care_medication_events")
        .select("id, medication_id, given_at, note")
        .in("medication_id", medIds)
        .order("given_at", { ascending: false })
        .limit(30);
      events = rows ?? [];
    }

    return {
      org,
      client,
      relatives: relatives ?? [],
      medications: medications ?? [],
      medicationEvents: events,
      visits: visits ?? [],
    };
  });

export const saveRelative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        id: z.string().uuid().optional(),
        clientId: z.string().uuid(),
        name: z.string().min(2).max(120),
        relation: z.string().max(60).optional(),
        email: z.string().email().max(160).optional().or(z.literal("")),
        phone: z.string().max(60).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      client_id: data.clientId,
      name: data.name.trim(),
      relation: blank(data.relation),
      email: blank(data.email),
      phone: blank(data.phone),
      notes: blank(data.notes),
    };
    if (data.id) {
      const { error } = await context.supabase.from("care_relatives").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("care_relatives").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeRelative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_relatives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Medicin ---------------- */

export const saveMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        id: z.string().uuid().optional(),
        clientId: z.string().uuid(),
        name: z.string().min(1).max(120),
        dose: z.string().max(80).optional(),
        times: z.string().max(120).optional(),
        instructions: z.string().max(1000).optional(),
        requires_delegation: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      client_id: data.clientId,
      name: data.name.trim(),
      dose: blank(data.dose),
      times: blank(data.times),
      instructions: blank(data.instructions),
      requires_delegation: data.requires_delegation ?? false,
    };
    if (data.id) {
      const { error } = await context.supabase.from("care_medications").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("care_medications").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_medications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Insatsmallar ---------------- */

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => slugInput.parse(d))
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: rows } = await context.supabase
      .from("care_task_templates")
      .select("id, title, description, default_minutes, is_active")
      .eq("org_id", org.id)
      .order("title");
    return { org, templates: rows ?? [] };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(120),
        description: z.string().max(1000).optional(),
        default_minutes: z.number().int().min(5).max(480),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      title: data.title.trim(),
      description: blank(data.description),
      default_minutes: data.default_minutes,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("care_task_templates")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("care_task_templates").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_task_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Schema ---------------- */

export const listSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), from: z.string(), to: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: visits } = await context.supabase
      .from("care_visits")
      .select(
        "id, title, starts_at, ends_at, status, note, client_id, staff_id, checkin_at, checkout_at, travel_meters, deviation",
      )
      .eq("org_id", org.id)
      .gte("starts_at", data.from)
      .lt("starts_at", data.to)
      .order("starts_at");
    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name, address")
      .eq("org_id", org.id)
      .order("name");
    const { data: staff } = await context.supabase
      .from("org_members")
      .select("id, display_name, role")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .order("display_name");
    const { data: templates } = await context.supabase
      .from("care_task_templates")
      .select("id, title, default_minutes")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .order("title");
    return {
      org,
      visits: visits ?? [],
      clients: clients ?? [],
      staff: staff ?? [],
      templates: templates ?? [],
    };
  });

export const saveVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        id: z.string().uuid().optional(),
        clientId: z.string().uuid(),
        staffId: z.string().uuid().nullable().optional(),
        title: z.string().max(120).optional(),
        starts_at: z.string().min(10),
        ends_at: z.string().min(10),
        note: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const row = {
      org_id: org.id,
      client_id: data.clientId,
      staff_id: data.staffId ?? null,
      title: blank(data.title),
      starts_at: new Date(data.starts_at).toISOString(),
      ends_at: new Date(data.ends_at).toISOString(),
      note: blank(data.note),
    };
    if (new Date(row.ends_at) <= new Date(row.starts_at)) {
      throw new Error("Sluttiden måste vara efter starttiden.");
    }
    if (data.id) {
      const { error } = await context.supabase.from("care_visits").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("care_visits").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_visits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Uppgifter per besök ---------------- */

export const listVisitTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), visitId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { data: rows } = await context.supabase
      .from("care_visit_tasks")
      .select("id, title, is_done, sort_order")
      .eq("visit_id", data.visitId)
      .order("sort_order");
    return rows ?? [];
  });

export const addVisitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        visitId: z.string().uuid(),
        title: z.string().min(1).max(120),
        templateId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_visit_tasks").insert({
      org_id: org.id,
      visit_id: data.visitId,
      title: data.title.trim(),
      template_id: data.templateId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeVisitTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_visit_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Personalkort ---------------- */

export const getStaffDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), memberId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { data: member } = await context.supabase
      .from("org_members")
      .select("id, display_name, email, phone, role, is_active, employment, work_hours, notes")
      .eq("id", data.memberId)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!member) throw new Error("Personalen hittades inte.");

    const { data: visits } = await context.supabase
      .from("care_visits")
      .select("id, title, starts_at, ends_at, status, client_id")
      .eq("org_id", org.id)
      .eq("staff_id", data.memberId)
      .gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("starts_at")
      .limit(50);
    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name")
      .eq("org_id", org.id);

    return { org, member, visits: visits ?? [], clients: clients ?? [] };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string(), id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase
      .from("org_members")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Samtycke för anhörig ---------------- */

export const CONSENT_SCOPES = [
  { key: "schema", label: "Schema och besök" },
  { key: "insatser", label: "Insatser och checklistor" },
  { key: "medicin", label: "Medicinlista" },
  { key: "anteckningar", label: "Anteckningar" },
] as const;

export const setRelativeConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        id: z.string().uuid(),
        consent: z.record(z.string(), z.boolean()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase
      .from("care_relatives")
      .update({ consent: data.consent })
      .eq("id", data.id)
      .eq("org_id", org.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Medicinlogg ---------------- */

export const logMedicationEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string(),
        medicationId: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const org = await requireOrg(context as Ctx, data.slug);
    const { error } = await context.supabase.from("care_medication_events").insert({
      org_id: org.id,
      medication_id: data.medicationId,
      given_at: new Date().toISOString(),
      given_by: context.userId,
      note: blank(data.note),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

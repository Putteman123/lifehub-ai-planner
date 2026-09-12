import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { CareRole } from "@/lib/care";

const leadSchema = z.object({
  org_name: z.string().min(2).max(160),
  contact_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(60).optional(),
  segment: z.string().max(60).optional(),
  message: z.string().max(2000).optional(),
});

/** Publik intresseanmälan från landningssidan. */
export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { error } = await supabase.from("sales_leads").insert({
      org_name: data.org_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone ?? null,
      segment: data.segment ?? null,
      message: data.message ?? null,
    });
    if (error) throw new Error("Kunde inte skicka just nu. Försök igen om en stund.");

    // Bekräftelsemejl – anmälan sparas även om mejlet inte går fram.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("care-lead", data.email, {
        templateData: {
          contactName: data.contact_name,
          orgName: data.org_name,
          message: data.message ?? "",
        },
      });
    } catch (mailError) {
      console.error("Kunde inte skicka bekräftelsemejl för intresseanmälan:", mailError);
    }

    return { ok: true };
  });

const SITE_URL = () => process.env["SITE_URL"] ?? "https://mellberg.online";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "superadmin",
  org_admin: "verksamhetsadmin",
  caregiver: "vårdpersonal",
  client: "brukare",
  relative: "anhörig",
};

export type CareMembership = {
  orgId: string;
  orgName: string;
  role: CareRole;
  modules: string[];
};

/** Vem är jag i vårdsystemet, och vilka organisationer tillhör jag? */
export const getCareContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: ownerFlag } = await supabase.rpc("is_app_owner", { _user_id: userId });
    const isOwner = ownerFlag === true;

    const { data: members } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(name)")
      .eq("user_id", userId)
      .eq("is_active", true);

    const orgIds = (members ?? []).map((m) => m.org_id);
    let moduleRows: { org_id: string; module: string; enabled: boolean }[] = [];
    if (orgIds.length > 0) {
      const { data } = await supabase
        .from("org_modules")
        .select("org_id, module, enabled")
        .in("org_id", orgIds);
      moduleRows = data ?? [];
    }

    const memberships: CareMembership[] = (members ?? []).map((m) => ({
      orgId: m.org_id,
      orgName: (m.organizations as { name: string } | null)?.name ?? "Organisation",
      role: m.role as CareRole,
      modules: moduleRows.filter((r) => r.org_id === m.org_id && r.enabled).map((r) => r.module),
    }));

    return { isOwner, memberships };
  });

/** Alla organisationer jag får se (superadmin ser alla). */
export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: orgs, error } = await context.supabase
      .from("organizations")
      .select("id, name, org_number, contact_email, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (orgs ?? []).map((o) => o.id);
    const { data: modules } = ids.length
      ? await context.supabase.from("org_modules").select("org_id, module, enabled").in("org_id", ids)
      : { data: [] as { org_id: string; module: string; enabled: boolean }[] };
    const { data: members } = ids.length
      ? await context.supabase.from("org_members").select("org_id, role").in("org_id", ids)
      : { data: [] as { org_id: string; role: string }[] };

    return (orgs ?? []).map((o) => ({
      ...o,
      modules: (modules ?? []).filter((m) => m.org_id === o.id && m.enabled).map((m) => m.module),
      memberCount: (members ?? []).filter((m) => m.org_id === o.id).length,
    }));
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(2).max(160),
        org_number: z.string().max(40).optional(),
        contact_email: z.string().email().max(160).optional(),
        modules: z.array(z.string().max(40)).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: ownerFlag } = await context.supabase.rpc("is_app_owner", {
      _user_id: context.userId,
    });
    if (ownerFlag !== true) throw new Error("Endast superadmin kan skapa organisationer.");

    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({
        name: data.name,
        org_number: data.org_number ?? null,
        contact_email: data.contact_email ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !org) throw new Error(error?.message ?? "Kunde inte skapa organisationen.");

    if (data.modules.length > 0) {
      await context.supabase
        .from("org_modules")
        .insert(data.modules.map((module) => ({ org_id: org.id, module, enabled: true })));
    }
    return { id: org.id };
  });

export const setOrgModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orgId: z.string().uuid(), modules: z.array(z.string().max(40)).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: ownerFlag } = await context.supabase.rpc("is_app_owner", {
      _user_id: context.userId,
    });
    if (ownerFlag !== true) throw new Error("Endast superadmin kan ändra moduler.");

    await context.supabase.from("org_modules").delete().eq("org_id", data.orgId);
    if (data.modules.length > 0) {
      const { error } = await context.supabase
        .from("org_modules")
        .insert(data.modules.map((module) => ({ org_id: data.orgId, module, enabled: true })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listOrgPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: members } = await context.supabase
      .from("org_members")
      .select("id, display_name, email, role, is_active, user_id")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: true });
    const { data: invites } = await context.supabase
      .from("org_invites")
      .select("id, email, display_name, role, status, expires_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    const { data: clients } = await context.supabase
      .from("care_clients")
      .select("id, name, address, phone, is_active")
      .eq("org_id", data.orgId)
      .order("name");
    return { members: members ?? [], invites: invites ?? [], clients: clients ?? [] };
  });

const roleEnum = z.enum(["superadmin", "org_admin", "caregiver", "client", "relative"]);

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        email: z.string().email().max(160),
        display_name: z.string().min(2).max(120),
        role: roleEnum,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase
      .from("org_invites")
      .insert({
        org_id: data.orgId,
        email: data.email,
        display_name: data.display_name,
        role: data.role,
        invited_by: context.userId,
      })
      .select("id, token")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "Kunde inte skapa inbjudan.");

    const { data: org } = await context.supabase
      .from("organizations")
      .select("name")
      .eq("id", data.orgId)
      .maybeSingle();

    let emailSent = false;
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("care-invite", data.email, {
        templateData: {
          orgName: org?.name ?? "LifeHub Vård",
          displayName: data.display_name,
          roleLabel: ROLE_LABEL[data.role] ?? data.role,
          acceptUrl: `${SITE_URL()}/invite/${invite.token}`,
        },
        idempotencyKey: `invite-${invite.id}`,
      });
      emailSent = result.sent;
    } catch (mailError) {
      console.error("Kunde inte skicka inbjudningsmejl:", mailError);
    }

    return { id: invite.id, token: invite.token, emailSent };
  });

/** Den inbjudne tackar ja och blir medlem i organisationen. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("org_invites")
      .select("id, org_id, email, display_name, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) throw new Error("Inbjudan hittades inte.");
    if (invite.status !== "pending") throw new Error("Inbjudan är redan använd.");
    if (new Date(invite.expires_at).getTime() < Date.now())
      throw new Error("Inbjudan har gått ut. Be om en ny.");

    const claimEmail = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (claimEmail && claimEmail !== invite.email.toLowerCase()) {
      throw new Error("Inbjudan gäller en annan e-postadress. Logga in med den adressen.");
    }

    const { error: memberError } = await supabaseAdmin.from("org_members").upsert(
      {
        org_id: invite.org_id,
        user_id: context.userId,
        email: invite.email,
        display_name: invite.display_name ?? invite.email,
        role: invite.role,
        is_active: true,
      },
      { onConflict: "org_id,user_id,role" },
    );
    if (memberError) throw new Error("Kunde inte lägga till dig i verksamheten.");

    await supabaseAdmin.from("org_invites").update({ status: "accepted" }).eq("id", invite.id);

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invite.org_id)
      .maybeSingle();

    return { ok: true, orgName: org?.name ?? "verksamheten", role: invite.role };
  });

export const removeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("org_invites").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addCareClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        name: z.string().min(2).max(120),
        address: z.string().max(200).optional(),
        phone: z.string().max(60).optional(),
        notes: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("care_clients").insert({
      org_id: data.orgId,
      name: data.name,
      address: data.address ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sales_leads")
      .select("id, org_name, contact_name, email, phone, segment, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

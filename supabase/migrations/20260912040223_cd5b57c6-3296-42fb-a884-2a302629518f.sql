
CREATE TYPE public.care_role AS ENUM ('superadmin', 'org_admin', 'caregiver', 'client', 'relative');

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  org_number text,
  contact_email text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  email text,
  display_name text NOT NULL,
  role public.care_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, role)
);
CREATE INDEX org_members_user_idx ON public.org_members (user_id);
CREATE INDEX org_members_org_idx ON public.org_members (org_id);

CREATE TABLE public.org_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, module)
);

CREATE TABLE public.org_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  role public.care_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_invites_org_idx ON public.org_invites (org_id);

CREATE TABLE public.care_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_clients_org_idx ON public.care_clients (org_id);

CREATE TABLE public.care_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  relative_user_id uuid NOT NULL,
  scope text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, relative_user_id, scope)
);

CREATE TABLE public.sales_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  segment text,
  message text,
  status text NOT NULL DEFAULT 'ny',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_modules TO authenticated;
GRANT ALL ON public.org_modules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT ALL ON public.org_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_clients TO authenticated;
GRANT ALL ON public.care_clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_consents TO authenticated;
GRANT ALL ON public.care_consents TO service_role;
GRANT INSERT ON public.sales_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _role public.care_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.role = _role AND m.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_app_owner(_user_id) OR public.has_org_role(_org_id, _user_id, 'org_admin')
$$;

CREATE OR REPLACE FUNCTION public.can_view_client(_client_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_clients c
    WHERE c.id = _client_id
      AND (
        c.user_id = _user_id
        OR public.is_app_owner(_user_id)
        OR public.has_org_role(c.org_id, _user_id, 'org_admin')
        OR public.has_org_role(c.org_id, _user_id, 'caregiver')
        OR EXISTS (
          SELECT 1 FROM public.care_consents k
          WHERE k.client_id = c.id AND k.relative_user_id = _user_id AND k.granted
        )
      )
  )
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_app_owner(auth.uid()) OR public.is_org_member(id, auth.uid()));
CREATE POLICY "org insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "org update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.can_manage_org(id, auth.uid())) WITH CHECK (public.can_manage_org(id, auth.uid()));
CREATE POLICY "org delete" ON public.organizations FOR DELETE TO authenticated
  USING (public.is_app_owner(auth.uid()));

CREATE POLICY "members read" ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_owner(auth.uid()) OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "members write" ON public.org_members FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

CREATE POLICY "modules read" ON public.org_modules FOR SELECT TO authenticated
  USING (public.is_app_owner(auth.uid()) OR public.is_org_member(org_id, auth.uid()));
CREATE POLICY "modules write" ON public.org_modules FOR ALL TO authenticated
  USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));

CREATE POLICY "invites manage" ON public.org_invites FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

CREATE POLICY "clients read" ON public.care_clients FOR SELECT TO authenticated
  USING (public.can_view_client(id, auth.uid()));
CREATE POLICY "clients write" ON public.care_clients FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()) OR public.has_org_role(org_id, auth.uid(), 'caregiver'))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()) OR public.has_org_role(org_id, auth.uid(), 'caregiver'));

CREATE POLICY "consents read" ON public.care_consents FOR SELECT TO authenticated
  USING (relative_user_id = auth.uid() OR public.can_view_client(client_id, auth.uid()));
CREATE POLICY "consents write" ON public.care_consents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.care_clients c WHERE c.id = client_id AND (c.user_id = auth.uid() OR public.can_manage_org(c.org_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.care_clients c WHERE c.id = client_id AND (c.user_id = auth.uid() OR public.can_manage_org(c.org_id, auth.uid()))));

CREATE POLICY "leads insert" ON public.sales_leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "leads owner read" ON public.sales_leads FOR SELECT TO authenticated
  USING (public.is_app_owner(auth.uid()));
CREATE POLICY "leads owner update" ON public.sales_leads FOR UPDATE TO authenticated
  USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));

CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER org_members_updated BEFORE UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER org_modules_updated BEFORE UPDATE ON public.org_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER org_invites_updated BEFORE UPDATE ON public.org_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER care_clients_updated BEFORE UPDATE ON public.care_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER care_consents_updated BEFORE UPDATE ON public.care_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sales_leads_updated BEFORE UPDATE ON public.sales_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

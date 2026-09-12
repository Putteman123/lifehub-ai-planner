ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_reference text,
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'pilot',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'prospekt',
  ADD COLUMN IF NOT EXISTS seats integer,
  ADD COLUMN IF NOT EXISTS internal_notes text;

CREATE TABLE IF NOT EXISTS public.org_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role care_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, role, module)
);

CREATE INDEX IF NOT EXISTS org_permissions_org_idx ON public.org_permissions(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_permissions TO authenticated;
GRANT ALL ON public.org_permissions TO service_role;

ALTER TABLE public.org_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medlemmar laser rattigheter"
  ON public.org_permissions FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()) OR public.can_manage_org(org_id, auth.uid()));

CREATE POLICY "Admin hanterar rattigheter"
  ON public.org_permissions FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_permission_privacy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.module = 'ekonomi' AND NEW.role IN ('org_admin', 'caregiver') THEN
    NEW.can_view := false;
    NEW.can_edit := false;
  END IF;
  IF NEW.can_edit AND NOT NEW.can_view THEN
    NEW.can_view := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_permissions_privacy ON public.org_permissions;
CREATE TRIGGER trg_org_permissions_privacy
  BEFORE INSERT OR UPDATE ON public.org_permissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_permission_privacy();

DROP TRIGGER IF EXISTS trg_org_permissions_updated ON public.org_permissions;
CREATE TRIGGER trg_org_permissions_updated
  BEFORE UPDATE ON public.org_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
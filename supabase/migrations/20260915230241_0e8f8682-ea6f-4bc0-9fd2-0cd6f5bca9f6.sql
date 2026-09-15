-- 1. Kortnamn (subdomän) per kund
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations (slug);

UPDATE public.organizations
SET slug = regexp_replace(
  lower(translate(name, 'åäöÅÄÖéÉüÜ', 'aaoaaoeeuu')),
  '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

UPDATE public.organizations SET slug = trim(both '-' from slug) WHERE slug LIKE '-%' OR slug LIKE '%-';
UPDATE public.organizations o SET slug = o.slug || '-' || substr(o.id::text, 1, 4)
WHERE EXISTS (SELECT 1 FROM public.organizations x WHERE x.slug = o.slug AND x.id <> o.id);

-- 2. Utökade fält
ALTER TABLE public.care_clients
  ADD COLUMN IF NOT EXISTS personal_number text,
  ADD COLUMN IF NOT EXISTS door_code text,
  ADD COLUMN IF NOT EXISTS key_info text;

ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS employment text,
  ADD COLUMN IF NOT EXISTS work_hours text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 3. Anhöriga
CREATE TABLE public.care_relatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  relation text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_relatives TO authenticated;
GRANT ALL ON public.care_relatives TO service_role;
ALTER TABLE public.care_relatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar anhoriga" ON public.care_relatives FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Personal ser anhoriga" ON public.care_relatives FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE TRIGGER care_relatives_updated BEFORE UPDATE ON public.care_relatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Insatsmallar
CREATE TABLE public.care_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  default_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_task_templates TO authenticated;
GRANT ALL ON public.care_task_templates TO service_role;
ALTER TABLE public.care_task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar insatsmallar" ON public.care_task_templates FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Medlem ser insatsmallar" ON public.care_task_templates FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));
CREATE TRIGGER care_task_templates_updated BEFORE UPDATE ON public.care_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Besök
CREATE TABLE public.care_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.org_members(id) ON DELETE SET NULL,
  title text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planerad',
  repeat_rule text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_visits_org_start_idx ON public.care_visits (org_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_visits TO authenticated;
GRANT ALL ON public.care_visits TO service_role;
ALTER TABLE public.care_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar besok" ON public.care_visits FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Personal ser besok" ON public.care_visits FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE POLICY "Personal uppdaterar besok" ON public.care_visits FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE TRIGGER care_visits_updated BEFORE UPDATE ON public.care_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Uppgifter per besök
CREATE TABLE public.care_visit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.care_visits(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.care_task_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_visit_tasks TO authenticated;
GRANT ALL ON public.care_visit_tasks TO service_role;
ALTER TABLE public.care_visit_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar uppgifter" ON public.care_visit_tasks FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Personal ser uppgifter" ON public.care_visit_tasks FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE POLICY "Personal bockar av uppgifter" ON public.care_visit_tasks FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE TRIGGER care_visit_tasks_updated BEFORE UPDATE ON public.care_visit_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Medicin
CREATE TABLE public.care_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,
  times text,
  instructions text,
  requires_delegation boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_medications TO authenticated;
GRANT ALL ON public.care_medications TO service_role;
ALTER TABLE public.care_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar medicin" ON public.care_medications FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Personal ser medicin" ON public.care_medications FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE TRIGGER care_medications_updated BEFORE UPDATE ON public.care_medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Utdelningar
CREATE TABLE public.care_medication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.care_medications(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.care_visits(id) ON DELETE SET NULL,
  given_at timestamptz NOT NULL DEFAULT now(),
  given_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_medication_events TO authenticated;
GRANT ALL ON public.care_medication_events TO service_role;
ALTER TABLE public.care_medication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin hanterar utdelningar" ON public.care_medication_events FOR ALL TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Personal ser utdelningar" ON public.care_medication_events FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), 'caregiver'));
CREATE POLICY "Personal registrerar utdelning" ON public.care_medication_events FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, auth.uid(), 'caregiver'));
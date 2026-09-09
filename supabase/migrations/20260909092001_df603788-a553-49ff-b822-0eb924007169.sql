CREATE OR REPLACE FUNCTION public.is_app_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_owner WHERE user_id = _user_id)
$$;

-- Platsinställningar: bara ägaren
DROP POLICY IF EXISTS "Inloggad ager platsinstallningar" ON public.location_settings;
CREATE POLICY "Owner manages location settings"
ON public.location_settings FOR ALL TO authenticated
USING (public.is_app_owner(auth.uid()))
WITH CHECK (public.is_app_owner(auth.uid()));

-- Mottagningslogg: bara ägaren får läsa
DROP POLICY IF EXISTS "Authenticated can read ingest log" ON public.location_ingest_log;
CREATE POLICY "Owner reads ingest log"
ON public.location_ingest_log FOR SELECT TO authenticated
USING (public.is_app_owner(auth.uid()));

-- Ägarraden: får bara skapas när ingen ägare finns, aldrig ändras eller tas bort
CREATE POLICY "Claim owner only when unclaimed"
ON public.app_owner FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM public.app_owner));

GRANT SELECT, INSERT ON public.app_owner TO authenticated;
GRANT ALL ON public.app_owner TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_settings TO authenticated;
GRANT ALL ON public.location_settings TO service_role;
GRANT SELECT ON public.location_ingest_log TO authenticated;
GRANT ALL ON public.location_ingest_log TO service_role;
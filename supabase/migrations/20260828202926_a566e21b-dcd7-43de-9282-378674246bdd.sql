CREATE POLICY "Service role manages app challenges"
ON public.app_challenges FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages app passkeys"
ON public.app_passkeys FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages vault challenges"
ON public.vault_challenges FOR ALL TO service_role
USING (true) WITH CHECK (true);
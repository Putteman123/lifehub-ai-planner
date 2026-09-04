CREATE TABLE public.location_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL,
  detail text,
  user_agent text,
  had_token boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.location_ingest_log TO authenticated;
GRANT ALL ON public.location_ingest_log TO service_role;
ALTER TABLE public.location_ingest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ingest log" ON public.location_ingest_log FOR SELECT TO authenticated USING (true);
CREATE INDEX location_ingest_log_received_idx ON public.location_ingest_log (received_at DESC);
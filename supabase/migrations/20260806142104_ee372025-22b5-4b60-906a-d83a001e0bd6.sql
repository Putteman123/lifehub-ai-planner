CREATE TABLE public.iptv_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  device_type text NOT NULL DEFAULT 'm3u',
  package_id text,
  months integer NOT NULL DEFAULT 12,
  status text NOT NULL DEFAULT 'aktiv',
  panel_id text,
  m3u_url text,
  username text,
  password text,
  expires_at timestamptz,
  note text,
  last_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iptv_lines TO authenticated;
GRANT ALL ON public.iptv_lines TO service_role;

ALTER TABLE public.iptv_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own iptv lines"
ON public.iptv_lines FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_iptv_lines_updated
BEFORE UPDATE ON public.iptv_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
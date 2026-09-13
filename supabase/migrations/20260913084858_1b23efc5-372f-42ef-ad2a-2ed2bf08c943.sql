CREATE TABLE IF NOT EXISTS public.cron_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_settings TO service_role;

ALTER TABLE public.cron_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cron_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
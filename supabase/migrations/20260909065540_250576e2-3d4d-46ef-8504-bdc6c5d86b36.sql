CREATE TABLE public.location_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY CHECK (id),
  token text NOT NULL,
  locator_mode text NOT NULL DEFAULT 'move' CHECK (locator_mode IN ('move','significant')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.location_settings TO authenticated;
GRANT ALL ON public.location_settings TO service_role;

ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inloggad ager platsinstallningar"
ON public.location_settings FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_location_settings_updated
BEFORE UPDATE ON public.location_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.location_settings (id, token, locator_mode)
VALUES (true, encode(gen_random_bytes(24), 'hex'), 'move')
ON CONFLICT (id) DO NOTHING;
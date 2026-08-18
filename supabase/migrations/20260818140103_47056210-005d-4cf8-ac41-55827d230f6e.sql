CREATE TABLE public.app_owner (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  user_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_owner TO authenticated;
GRANT ALL ON public.app_owner TO service_role;

ALTER TABLE public.app_owner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read owner row"
ON public.app_owner FOR SELECT TO authenticated
USING (auth.uid() = user_id);
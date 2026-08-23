CREATE TABLE public.pantry_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pantry_item_id uuid REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  name_key text NOT NULL,
  merchant text,
  price numeric NOT NULL,
  quantity text,
  is_campaign boolean NOT NULL DEFAULT false,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'kvitto',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_prices TO authenticated;
GRANT ALL ON public.pantry_prices TO service_role;

ALTER TABLE public.pantry_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pantry prices"
ON public.pantry_prices
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX pantry_prices_user_key_idx ON public.pantry_prices (user_id, name_key, purchased_at DESC);
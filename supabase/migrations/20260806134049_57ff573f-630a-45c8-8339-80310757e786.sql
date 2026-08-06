ALTER TABLE public.events ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.events ALTER COLUMN category SET DEFAULT 'privat';

CREATE TABLE public.event_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  color_token text NOT NULL DEFAULT 'cat-privat',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_categories TO authenticated;
GRANT ALL ON public.event_categories TO service_role;

ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own event categories"
ON public.event_categories FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_event_categories_updated
BEFORE UPDATE ON public.event_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
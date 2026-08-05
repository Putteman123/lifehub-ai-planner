CREATE TABLE public.travel_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'rutt' CHECK (kind IN ('rutt','veckodag')),
  route_key text,
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  preferred_mode travel_mode NOT NULL DEFAULT 'bil',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, route_key, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_preferences TO authenticated;
GRANT ALL ON public.travel_preferences TO service_role;

ALTER TABLE public.travel_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own travel preferences" ON public.travel_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_travel_preferences_updated
  BEFORE UPDATE ON public.travel_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
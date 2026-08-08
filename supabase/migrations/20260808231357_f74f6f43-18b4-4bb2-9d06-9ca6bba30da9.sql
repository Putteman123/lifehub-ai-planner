CREATE TABLE public.day_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day DATE NOT NULL,
  entry_kind visit_kind NOT NULL DEFAULT 'besok',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  distance_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  travel_mode travel_mode NOT NULL DEFAULT 'okant',
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  suggested_label TEXT,
  suggested_activity TEXT,
  reasoning TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_segments TO authenticated;
GRANT ALL ON public.day_segments TO service_role;

ALTER TABLE public.day_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own day segments"
  ON public.day_segments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_day_segments_user_day ON public.day_segments (user_id, day, starts_at);

CREATE TRIGGER trg_day_segments_updated
  BEFORE UPDATE ON public.day_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.andrea_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  call_name TEXT,
  tone TEXT NOT NULL DEFAULT 'varm',
  directness SMALLINT NOT NULL DEFAULT 3,
  focus TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.andrea_profile TO authenticated;
GRANT ALL ON public.andrea_profile TO service_role;

ALTER TABLE public.andrea_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own andrea profile"
  ON public.andrea_profile FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_andrea_profile_updated
  BEFORE UPDATE ON public.andrea_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS distance_verified boolean NOT NULL DEFAULT false;
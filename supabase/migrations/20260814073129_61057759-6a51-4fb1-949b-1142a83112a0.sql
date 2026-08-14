ALTER TABLE public.day_segments
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS seen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_total numeric NOT NULL DEFAULT 0;

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS address text;
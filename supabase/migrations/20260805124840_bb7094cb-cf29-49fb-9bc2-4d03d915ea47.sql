CREATE TYPE public.visit_kind AS ENUM ('besok', 'resa');

ALTER TABLE public.visits
  ADD COLUMN entry_kind public.visit_kind NOT NULL DEFAULT 'besok',
  ADD COLUMN distance_m double precision NOT NULL DEFAULT 0,
  ADD COLUMN end_lat double precision,
  ADD COLUMN end_lng double precision;

CREATE INDEX IF NOT EXISTS visits_user_kind_arrived_idx
  ON public.visits (user_id, entry_kind, arrived_at DESC);
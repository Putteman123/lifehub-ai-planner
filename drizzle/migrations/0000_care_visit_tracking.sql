ALTER TABLE public.care_visits
  ADD COLUMN IF NOT EXISTS checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz,
  ADD COLUMN IF NOT EXISTS travel_meters integer,
  ADD COLUMN IF NOT EXISTS travel_seconds integer,
  ADD COLUMN IF NOT EXISTS deviation text;

CREATE INDEX IF NOT EXISTS care_visits_org_starts_idx ON public.care_visits (org_id, starts_at);
CREATE INDEX IF NOT EXISTS care_visits_staff_starts_idx ON public.care_visits (staff_id, starts_at);
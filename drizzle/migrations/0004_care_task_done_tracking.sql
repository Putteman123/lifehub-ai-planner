ALTER TABLE public.care_visit_tasks
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS done_by uuid,
  ADD COLUMN IF NOT EXISTS done_role text;

ALTER TABLE public.care_medication_events
  ADD COLUMN IF NOT EXISTS given_role text;
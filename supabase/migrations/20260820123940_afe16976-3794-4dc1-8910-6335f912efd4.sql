ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interval_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS anchor_month smallint,
  ADD COLUMN IF NOT EXISTS sync_calendar boolean NOT NULL DEFAULT true;
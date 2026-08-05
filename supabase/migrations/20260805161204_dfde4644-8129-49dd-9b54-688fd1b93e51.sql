ALTER TABLE public.calendars ADD COLUMN IF NOT EXISTS external_id text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='calendar_source' AND e.enumlabel='google') THEN
    ALTER TYPE public.calendar_source ADD VALUE 'google';
  END IF;
END $$;
CREATE TABLE public.mail_seen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  had_finding boolean NOT NULL DEFAULT false,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_seen TO authenticated;
GRANT ALL ON public.mail_seen TO service_role;

ALTER TABLE public.mail_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mail_seen"
ON public.mail_seen FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX mail_seen_user_scanned_idx ON public.mail_seen (user_id, scanned_at DESC);

ALTER TABLE public.mail_findings
  ADD COLUMN IF NOT EXISTS suggested_slots jsonb,
  ADD COLUMN IF NOT EXISTS attachment_names text[];
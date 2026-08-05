CREATE TABLE public.mail_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('label','sender','keyword')),
  value text NOT NULL,
  mode text NOT NULL DEFAULT 'include' CHECK (mode IN ('include','exclude')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_rules TO authenticated;
GRANT ALL ON public.mail_rules TO service_role;

ALTER TABLE public.mail_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own mail rules" ON public.mail_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_mail_rules_updated BEFORE UPDATE ON public.mail_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mail_rules_user ON public.mail_rules (user_id, is_active);
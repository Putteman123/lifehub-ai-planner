CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  contact text,
  phone text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  external_id text NOT NULL,
  source text NOT NULL DEFAULT 'genvag',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

CREATE INDEX sms_messages_user_time_idx ON public.sms_messages (user_id, sent_at DESC);
CREATE INDEX sms_messages_phone_idx ON public.sms_messages (user_id, phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Egna sms" ON public.sms_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sms_messages_updated_at BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sms_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','sent','failed','cancelled')),
  error text,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sms_outbox_status_idx ON public.sms_outbox (user_id, status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_outbox TO authenticated;
GRANT ALL ON public.sms_outbox TO service_role;
ALTER TABLE public.sms_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Egen sms-utkorg" ON public.sms_outbox FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sms_outbox_updated_at BEFORE UPDATE ON public.sms_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
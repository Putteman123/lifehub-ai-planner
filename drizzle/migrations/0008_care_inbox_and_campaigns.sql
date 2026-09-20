CREATE TABLE public.care_inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'lead',
  from_name text NOT NULL,
  from_email text NOT NULL,
  org_name text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'ny',
  unread boolean NOT NULL DEFAULT true,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.care_inbox_threads(id) ON DELETE CASCADE,
  direction text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_inbox_messages_thread_idx ON public.care_inbox_messages(thread_id, created_at);

CREATE TABLE public.care_inbox_settings (
  id boolean PRIMARY KEY DEFAULT true,
  forward_email text,
  forward_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_inbox_settings_single CHECK (id)
);
INSERT INTO public.care_inbox_settings (id, forward_email, forward_enabled)
VALUES (true, 'patrick@mellberg.online', true);

CREATE TABLE public.care_marketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL UNIQUE,
  org_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.care_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.care_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_campaign_recipients_campaign_idx ON public.care_campaign_recipients(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_inbox_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_inbox_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_inbox_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_marketing_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_campaign_recipients TO authenticated;
GRANT ALL ON public.care_inbox_threads TO service_role;
GRANT ALL ON public.care_inbox_messages TO service_role;
GRANT ALL ON public.care_inbox_settings TO service_role;
GRANT ALL ON public.care_marketing_contacts TO service_role;
GRANT ALL ON public.care_campaigns TO service_role;
GRANT ALL ON public.care_campaign_recipients TO service_role;

ALTER TABLE public.care_inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_inbox_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages inbox threads" ON public.care_inbox_threads
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "owner manages inbox messages" ON public.care_inbox_messages
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "owner manages inbox settings" ON public.care_inbox_settings
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "owner manages marketing contacts" ON public.care_marketing_contacts
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "owner manages campaigns" ON public.care_campaigns
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
CREATE POLICY "owner manages campaign recipients" ON public.care_campaign_recipients
  FOR ALL TO authenticated USING (public.is_app_owner(auth.uid())) WITH CHECK (public.is_app_owner(auth.uid()));
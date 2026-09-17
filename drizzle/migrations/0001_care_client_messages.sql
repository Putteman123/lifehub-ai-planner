ALTER TABLE public.care_relatives ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE OR REPLACE FUNCTION public.can_access_care_client(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_clients c
    WHERE c.id = _client_id
      AND (
        c.user_id = _user_id
        OR public.can_manage_org(c.org_id, _user_id)
        OR public.is_org_member(c.org_id, _user_id)
        OR EXISTS (
          SELECT 1 FROM public.care_relatives r
          WHERE r.client_id = c.id AND r.user_id = _user_id
        )
      )
  )
$$;

CREATE TABLE IF NOT EXISTS public.care_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'personal',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_messages_client_idx ON public.care_messages (client_id, created_at);

GRANT SELECT, INSERT ON public.care_messages TO authenticated;
GRANT ALL ON public.care_messages TO service_role;

ALTER TABLE public.care_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deltagare läser brukarens meddelanden" ON public.care_messages;
CREATE POLICY "Deltagare läser brukarens meddelanden"
ON public.care_messages FOR SELECT TO authenticated
USING (public.can_access_care_client(client_id, auth.uid()));

DROP POLICY IF EXISTS "Deltagare skriver meddelanden" ON public.care_messages;
CREATE POLICY "Deltagare skriver meddelanden"
ON public.care_messages FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.can_access_care_client(client_id, auth.uid()));
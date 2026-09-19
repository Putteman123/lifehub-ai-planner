-- Inköpslista per brukare
CREATE TABLE public.care_shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  quantity text,
  note text,
  amount numeric,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid,
  created_by uuid,
  created_role text,
  created_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_shopping_items_client_idx ON public.care_shopping_items(client_id, is_done);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_shopping_items TO authenticated;
GRANT ALL ON public.care_shopping_items TO service_role;
ALTER TABLE public.care_shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deltagare ser inköp" ON public.care_shopping_items
  FOR SELECT TO authenticated
  USING (public.can_access_care_client(client_id, auth.uid()));
CREATE POLICY "Deltagare lägger till inköp" ON public.care_shopping_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_care_client(client_id, auth.uid()));
CREATE POLICY "Deltagare uppdaterar inköp" ON public.care_shopping_items
  FOR UPDATE TO authenticated
  USING (public.can_access_care_client(client_id, auth.uid()))
  WITH CHECK (public.can_access_care_client(client_id, auth.uid()));
CREATE POLICY "Deltagare tar bort inköp" ON public.care_shopping_items
  FOR DELETE TO authenticated
  USING (public.can_access_care_client(client_id, auth.uid()));

CREATE TRIGGER care_shopping_items_updated
  BEFORE UPDATE ON public.care_shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ekonomiska grunduppgifter per verksamhet
CREATE TABLE public.care_org_finance (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL DEFAULT 480,
  staff_cost_per_hour numeric NOT NULL DEFAULT 280,
  travel_cost_per_km numeric NOT NULL DEFAULT 25,
  currency text NOT NULL DEFAULT 'SEK',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_org_finance TO authenticated;
GRANT ALL ON public.care_org_finance TO service_role;
ALTER TABLE public.care_org_finance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ser ekonomi" ON public.care_org_finance
  FOR SELECT TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Admin skapar ekonomi" ON public.care_org_finance
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));
CREATE POLICY "Admin ändrar ekonomi" ON public.care_org_finance
  FOR UPDATE TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

CREATE TRIGGER care_org_finance_updated
  BEFORE UPDATE ON public.care_org_finance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Läskvitton för chatten
CREATE TABLE public.care_message_reads (
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.care_clients(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_message_reads TO authenticated;
GRANT ALL ON public.care_message_reads TO service_role;
ALTER TABLE public.care_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Egna läskvitton" ON public.care_message_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

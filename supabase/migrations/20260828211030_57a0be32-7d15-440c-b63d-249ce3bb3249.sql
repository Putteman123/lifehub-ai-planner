CREATE TABLE public.mail_findings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  thread_id text,
  kind text NOT NULL DEFAULT 'faktura',
  sender text,
  subject text,
  merchant text,
  amount numeric,
  currency text NOT NULL DEFAULT 'SEK',
  due_date date,
  occurred_at timestamp with time zone,
  reference text,
  category text,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  summary text,
  raw_ai jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_todo_id uuid REFERENCES public.todos(id) ON DELETE SET NULL,
  created_spend_id uuid REFERENCES public.spend_entries(id) ON DELETE SET NULL,
  created_expense_id uuid REFERENCES public.fixed_expenses(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_findings TO authenticated;
GRANT ALL ON public.mail_findings TO service_role;

ALTER TABLE public.mail_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own mail findings"
ON public.mail_findings FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_mail_findings_updated
BEFORE UPDATE ON public.mail_findings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mail_findings_status ON public.mail_findings (user_id, status, created_at DESC);
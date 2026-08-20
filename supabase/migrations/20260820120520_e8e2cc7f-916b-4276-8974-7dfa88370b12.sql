CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  principal numeric NOT NULL DEFAULT 0,
  disbursed_on date NOT NULL DEFAULT current_date,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  monthly_payment numeric NOT NULL DEFAULT 0,
  monthly_interest numeric NOT NULL DEFAULT 0,
  due_day integer NOT NULL DEFAULT 27,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own loans" ON public.loans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_loans_updated
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.finance_incomes
  ADD COLUMN loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL;

ALTER TABLE public.fixed_expenses
  ADD COLUMN loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  ADD COLUMN part text;
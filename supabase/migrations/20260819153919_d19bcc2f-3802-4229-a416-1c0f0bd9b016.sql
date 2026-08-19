CREATE TABLE public.fixed_expense_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.fixed_expenses(id) ON DELETE CASCADE,
  period text NOT NULL,
  paid_on date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manuell',
  file_id uuid REFERENCES public.finance_files(id) ON DELETE SET NULL,
  todo_id uuid REFERENCES public.todos(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (expense_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expense_payments TO authenticated;
GRANT ALL ON public.fixed_expense_payments TO service_role;

ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own fixed expense payments"
ON public.fixed_expense_payments FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_fixed_expense_payments_updated
BEFORE UPDATE ON public.fixed_expense_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fixed_expense_payments_period ON public.fixed_expense_payments (user_id, period);
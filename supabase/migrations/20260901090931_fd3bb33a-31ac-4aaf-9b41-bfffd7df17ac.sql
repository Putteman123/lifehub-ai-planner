ALTER TABLE public.fixed_expense_payments
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL;
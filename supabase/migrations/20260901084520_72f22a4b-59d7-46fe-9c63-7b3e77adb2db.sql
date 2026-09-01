ALTER TABLE public.finance_incomes
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_on date,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS category text;
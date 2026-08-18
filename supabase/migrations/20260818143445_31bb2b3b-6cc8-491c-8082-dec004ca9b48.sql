CREATE TABLE public.account_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transfers" ON public.account_transfers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_account_transfers_updated BEFORE UPDATE ON public.account_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  track TEXT,
  game_type TEXT NOT NULL DEFAULT 'Annat',
  rows_count INTEGER NOT NULL DEFAULT 1,
  stake NUMERIC NOT NULL DEFAULT 0,
  payout NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'oavgjort',
  account_id UUID REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  spend_id UUID REFERENCES public.spend_entries(id) ON DELETE SET NULL,
  receipt_path TEXT,
  note TEXT,
  raw_ai JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bets" ON public.bets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_bets_updated BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
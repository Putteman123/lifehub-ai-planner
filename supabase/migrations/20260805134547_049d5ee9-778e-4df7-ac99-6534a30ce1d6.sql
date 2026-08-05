CREATE TABLE public.visit_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_edits_visit ON public.visit_edits (visit_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_edits TO authenticated;
GRANT ALL ON public.visit_edits TO service_role;

ALTER TABLE public.visit_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own visit edits" ON public.visit_edits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
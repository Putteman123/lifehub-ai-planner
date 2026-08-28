CREATE TABLE public.andrea_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'preference', 'relationship', 'routine')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  source TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.90 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.andrea_memories TO authenticated;
GRANT ALL ON public.andrea_memories TO service_role;

ALTER TABLE public.andrea_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Andrea memories"
ON public.andrea_memories FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own Andrea memories"
ON public.andrea_memories FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Andrea memories"
ON public.andrea_memories FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Andrea memories"
ON public.andrea_memories FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX andrea_memories_user_content_unique
ON public.andrea_memories (user_id, lower(content));

CREATE INDEX andrea_memories_user_status_confirmed_idx
ON public.andrea_memories (user_id, status, last_confirmed_at DESC);

CREATE TRIGGER trg_andrea_memories_updated
BEFORE UPDATE ON public.andrea_memories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
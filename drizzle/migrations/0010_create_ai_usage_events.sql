CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('google', 'openai', 'perplexity', 'lovable')),
  feature text NOT NULL DEFAULT 'general' CHECK (char_length(feature) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App owners can read AI usage"
ON public.ai_usage_events
FOR SELECT
TO authenticated
USING (public.is_app_owner(auth.uid()));

CREATE INDEX ai_usage_events_created_at_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX ai_usage_events_provider_created_at_idx ON public.ai_usage_events (provider, created_at DESC);

COMMENT ON TABLE public.ai_usage_events IS 'Metadata-only log of successful AI responses; never stores prompts, responses, keys, or personal content.';
CREATE TABLE public.trip_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_label TEXT NOT NULL,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_label TEXT NOT NULL,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  driven_on DATE NOT NULL DEFAULT CURRENT_DATE,
  driven_km NUMERIC NOT NULL DEFAULT 0,
  travel_mode travel_mode NOT NULL DEFAULT 'bil',
  purpose TEXT,
  route_meters INTEGER,
  route_minutes INTEGER,
  route_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_logs TO authenticated;
GRANT ALL ON public.trip_logs TO service_role;

ALTER TABLE public.trip_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trip logs"
ON public.trip_logs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX trip_logs_user_date_idx ON public.trip_logs (user_id, driven_on DESC);

CREATE TRIGGER update_trip_logs_updated_at
BEFORE UPDATE ON public.trip_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.iptv_lines
  ADD COLUMN IF NOT EXISTS mac text,
  ADD COLUMN IF NOT EXISTS protocol_code text,
  ADD COLUMN IF NOT EXISTS package_name text;
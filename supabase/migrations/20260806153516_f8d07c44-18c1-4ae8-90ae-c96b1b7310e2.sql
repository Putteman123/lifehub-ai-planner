ALTER TABLE public.iptv_lines
  ADD COLUMN IF NOT EXISTS online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS iptv_lines_user_panel_id_key
  ON public.iptv_lines (user_id, panel_id) WHERE panel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS iptv_lines_user_username_key
  ON public.iptv_lines (user_id, username) WHERE username IS NOT NULL;
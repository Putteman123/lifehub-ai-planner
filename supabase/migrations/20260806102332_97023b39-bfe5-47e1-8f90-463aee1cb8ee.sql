ALTER TABLE public.app_passkeys ADD COLUMN IF NOT EXISTS rp_id text;
ALTER TABLE public.vault_credentials ADD COLUMN IF NOT EXISTS rp_id text;
CREATE INDEX IF NOT EXISTS app_passkeys_rp_id_idx ON public.app_passkeys (rp_id);
CREATE INDEX IF NOT EXISTS vault_credentials_rp_id_idx ON public.vault_credentials (rp_id);
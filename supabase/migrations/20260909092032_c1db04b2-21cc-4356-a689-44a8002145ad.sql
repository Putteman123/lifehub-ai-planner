REVOKE EXECUTE ON FUNCTION public.is_app_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_app_owner(uuid) TO authenticated, service_role;
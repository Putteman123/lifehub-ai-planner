
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, public.care_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.care_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_manage_org(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_view_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_client(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_app_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_owner(uuid) TO authenticated, service_role;

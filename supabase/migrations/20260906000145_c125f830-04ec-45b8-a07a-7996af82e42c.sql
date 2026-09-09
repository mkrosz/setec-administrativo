REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;
-- The production schema grants the trusted server role full access to
-- user profiles. The tenant-hardening migration intentionally removes
-- privileges from anon/authenticated but must not remove service_role access.
GRANT ALL PRIVILEGES ON TABLE public.users TO service_role;

DO $verify_service_role$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.users', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.users', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.users', 'DELETE')
  THEN
    RAISE EXCEPTION
      'SECURITY_ASSERTION_FAILED: service_role must retain full users-table access';
  END IF;
END
$verify_service_role$;

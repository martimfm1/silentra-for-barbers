-- Restore the hosted Supabase service-role baseline for the incremental
-- migration history. API routes and workers use service_role for tenant-
-- scoped server operations; this role is trusted and bypasses RLS.
-- Client roles remain governed by the explicit table/column grants and RLS
-- policies established by the security migrations.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure tables/sequences created by future migrations retain the same
-- trusted backend privileges without granting them to anon/authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

DO $verify_service_role_schema$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.shops', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.users', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.barbershops', 'SELECT')
    OR NOT has_sequence_privilege('service_role', 'public.shops_id_seq', 'USAGE')
  THEN
    RAISE EXCEPTION
      'SECURITY_ASSERTION_FAILED: service_role must retain trusted public-schema data access';
  END IF;
END
$verify_service_role_schema$;

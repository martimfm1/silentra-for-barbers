begin;

-- These tables are internal queues, audit/configuration data, or token/rate-limit
-- storage. The application accesses them through trusted server-side clients.
-- Remove inherited PUBLIC and client-role privileges as defense in depth;
-- service_role retains explicit access for API routes and workers.
-- Some legacy/optional tables exist in production's schema snapshot but
-- are not created by the ordered migration history (for example email_queue).
-- Harden every table that is present without making a clean migration replay
-- depend on objects that may not exist in a fresh project.
DO $internal_table_grants$
DECLARE
  v_table text;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY[
      'audit_logs',
      'email_queue',
      'notification_queue',
      'notification_subscriptions',
      'platform_settings',
      'rate_limits',
      'verification_tokens'
    ])
  LOOP
    IF pg_catalog.to_regclass(pg_catalog.format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated',
        v_table
      );
      EXECUTE pg_catalog.format(
        'GRANT ALL ON TABLE public.%I TO service_role',
        v_table
      );
    END IF;
  END LOOP;
END
$internal_table_grants$;

commit;

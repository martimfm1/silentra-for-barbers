-- The plan enum exists in the production schema snapshot but was missing
-- from the ordered migration chain. Ensure clean local/test databases can
-- replay the billing migrations from zero without changing existing projects.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type AS type
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname = 'subscription_plan'
  ) THEN
    EXECUTE 'CREATE TYPE public.subscription_plan AS ENUM (''free'', ''pro'', ''enterprise'')';
  END IF;
END
$migration$;

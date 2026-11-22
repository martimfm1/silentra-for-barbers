-- The Auth profile trigger function is introduced by
-- 20261103120051_fix_new_user_role_escalation.sql. Apply its execution and
-- search_path hardening after the function has been created.
DO $function_security$
BEGIN
  IF pg_catalog.to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.handle_new_user()
      FROM public, anon, authenticated;
    ALTER FUNCTION public.handle_new_user()
      SET search_path = public;
  END IF;
END
$function_security$;

-- Directory participation is included on every plan. Pro and Enterprise
-- unlock the ability to opt out of public directory discovery.
ALTER TABLE public.barbershops
  ALTER COLUMN is_public_in_directory SET DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.set_barbershop_directory_visibility(
  p_actor_user_id uuid,
  p_barbershop_id uuid,
  p_visible boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_barbershop_id uuid;
  v_role text;
  v_plan text := 'free';
BEGIN
  SELECT u.barbershop_id, u.role
    INTO v_user_barbershop_id, v_role
  FROM public.users u
  WHERE u.id = p_actor_user_id;

  IF v_user_barbershop_id IS NULL OR v_user_barbershop_id <> p_barbershop_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'BARBERSHOP_ACCESS_DENIED';
  END IF;

  IF COALESCE(LOWER(v_role), '') NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DIRECTORY_VISIBILITY_DENIED';
  END IF;

  SELECT CASE
    WHEN s.plan_override IN ('pro', 'enterprise') THEN s.plan_override::text
    WHEN s.status IN ('active', 'trialing') AND s.plan IN ('pro', 'enterprise') THEN s.plan::text
    ELSE 'free'
  END
    INTO v_plan
  FROM public.subscriptions s
  JOIN public.users u ON u.id = s.user_id
  WHERE u.barbershop_id = p_barbershop_id
  ORDER BY CASE
    WHEN s.plan_override IN ('pro', 'enterprise') THEN 0
    WHEN s.status IN ('active', 'trialing') THEN 1
    ELSE 2
  END,
  s.updated_at DESC
  LIMIT 1;

  -- Showing a barbershop is available on every plan. Hiding it is a Pro
  -- entitlement and must be checked at the database boundary.
  IF NOT COALESCE(p_visible, TRUE) AND v_plan NOT IN ('pro', 'enterprise') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DIRECTORY_VISIBILITY_PRO_REQUIRED';
  END IF;

  UPDATE public.barbershops
  SET is_public_in_directory = COALESCE(p_visible, TRUE)
  WHERE id = p_barbershop_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_barbershop_directory_visibility(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_barbershop_directory_visibility(uuid, uuid, boolean)
  TO service_role;

-- A Free barbershop cannot retain an old opt-out after a downgrade. Restore
-- directory presence for shops without a current Pro/Enterprise entitlement.
UPDATE public.barbershops b
SET is_public_in_directory = TRUE
WHERE b.is_public_in_directory = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.barbershop_id = b.id
      AND (
        s.plan_override IN ('pro', 'enterprise')
        OR (
          s.status IN ('active', 'trialing')
          AND s.plan IN ('pro', 'enterprise')
        )
      )
  );

CREATE OR REPLACE FUNCTION public.restore_directory_visibility_without_pro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_barbershop_id uuid;
  v_has_directory_control boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  SELECT u.barbershop_id
    INTO v_barbershop_id
  FROM public.users u
  WHERE u.id = v_user_id;

  IF v_barbershop_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.barbershop_id = v_barbershop_id
      AND (
        s.plan_override IN ('pro', 'enterprise')
        OR (
          s.status IN ('active', 'trialing')
          AND s.plan IN ('pro', 'enterprise')
        )
      )
  )
  INTO v_has_directory_control;

  IF NOT v_has_directory_control THEN
    UPDATE public.barbershops
    SET is_public_in_directory = TRUE
    WHERE id = v_barbershop_id
      AND is_public_in_directory = FALSE;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_directory_visibility_without_pro()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS restore_directory_visibility_without_pro
  ON public.subscriptions;

CREATE TRIGGER restore_directory_visibility_without_pro
AFTER INSERT OR UPDATE OF status, plan, plan_override OR DELETE
ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.restore_directory_visibility_without_pro();

begin;

-- The legacy quota RPC trusts p_user_id and does not bind it to auth.uid().
-- Current application code uses create_professional_with_plan_quota instead.
-- Keep the legacy RPC server-only so a public caller cannot create staff in a
-- barbershop by supplying an owner's user ID.
revoke all on function public.create_professional_with_quota(uuid, uuid, text, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.create_professional_with_quota(uuid, uuid, text, numeric, boolean)
  to service_role;

-- These count/limit helpers are called by trusted server routes or other
-- SECURITY DEFINER functions. Client roles must not query arbitrary tenants'
-- seat counts or plan limits directly.
revoke all on function public.get_effective_professional_count(uuid)
  from public, anon, authenticated;
grant execute on function public.get_effective_professional_count(uuid)
  to service_role;

revoke all on function public.get_effective_team_limit(uuid)
  from public, anon, authenticated;
grant execute on function public.get_effective_team_limit(uuid)
  to service_role;

revoke all on function public.get_effective_team_member_count(uuid)
  from public, anon, authenticated;
grant execute on function public.get_effective_team_member_count(uuid)
  to service_role;

revoke all on function public.get_effective_team_seat_count(uuid)
  from public, anon, authenticated;
grant execute on function public.get_effective_team_seat_count(uuid)
  to service_role;

-- These functions may be introduced by later migrations or absent in a
-- minimal replay. Revoke client execution whenever the function exists.
DO $function_privileges$
DECLARE
  v_function text;
BEGIN
  FOR v_function IN
    SELECT unnest(ARRAY[
      'public.ensure_shop_slug()',
      'public.handle_new_user()',
      'public.handle_new_user_subscription()',
      'public.handle_updated_at()',
      'public.handle_update_timestamp()',
      'public.set_updated_at()',
      'public.update_updated_at_column()',
      'public.protect_user_tenant_fields()',
      'public.record_marketplace_order_status_event()',
      'public.rls_auto_enable()',
      'public.sync_shop_review_stats()',
      'public.notify_new_review()',
      'public.sync_barbershop_name_to_shops()',
      'public.sync_barbershop_phone_to_shops()',
      'public.sync_barbershop_address_to_shops()',
      'public.sync_barbershop_details_to_shops()',
      'public.sync_barbershop_to_shop()',
      'public.atualizar_receita_barbearia()',
      'public.guard_cancelled_marketing_campaign()',
      'public.touch_barbershop_billing_accounts_updated_at()'
    ])
  LOOP
    IF pg_catalog.to_regprocedure(v_function) IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated',
        v_function
      );
    END IF;
  END LOOP;
END
$function_privileges$;

-- These helpers are used by authenticated authorization/RLS checks. They
-- must not be callable by anon; keep authenticated and trusted server access.
-- Some legacy helpers are present in the schema snapshot but absent from the
-- ordered migration history. Apply permissions only when each function exists.
DO $authenticated_helpers$
DECLARE
  v_function text;
BEGIN
  FOR v_function IN
    SELECT unnest(ARRAY[
      'public.get_my_barbershop_id()',
      'public.is_admin()',
      'public.complete_barbershop_onboarding(uuid)',
      'public.set_barbershop_avatar_url(uuid, text)'
    ])
  LOOP
    IF pg_catalog.to_regprocedure(v_function) IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'REVOKE ALL ON FUNCTION %s FROM public, anon',
        v_function
      );
      EXECUTE pg_catalog.format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        v_function
      );
    END IF;
  END LOOP;
END
$authenticated_helpers$;

-- Pin search_path when the referenced trigger/helper function exists.
-- Some legacy functions are recreated by later migrations; the follow-up
-- migration reapplies this protection after those definitions are installed.
DO $function_search_paths$
DECLARE
  v_function text;
BEGIN
  FOR v_function IN
    SELECT unnest(ARRAY[
      'public.sync_barbershop_name_to_shops()',
      'public.update_updated_at_column()',
      'public.sync_barbershop_phone_to_shops()',
      'public.notify_new_review()',
      'public.sync_barbershop_address_to_shops()',
      'public.normalize_shop_slug(text)',
      'public.atualizar_receita_barbearia()',
      'public.sync_barbershop_to_shop()',
      'public.create_professional_with_quota(uuid, uuid, text, numeric, boolean)',
      'public.sync_barbershop_details_to_shops()',
      'public.check_if_admin()',
      'public.is_admin()',
      'public.handle_new_user()',
      'public.handle_update_timestamp()',
      'public.set_updated_at()',
      'public.touch_barbershop_billing_accounts_updated_at()',
      'public.guard_cancelled_marketing_campaign()',
      'public.marketplace_order_status_customer_message(text)'
    ])
  LOOP
    IF pg_catalog.to_regprocedure(v_function) IS NOT NULL THEN
      EXECUTE pg_catalog.format(
        'ALTER FUNCTION %s SET search_path = public',
        v_function
      );
    END IF;
  END LOOP;
END
$function_search_paths$;

-- Public review submission is intentionally callable without an account; its
-- RPC performs its own shop-visibility and input validation checks.
comment on function public.submit_public_review(uuid, text, integer, text)
  is 'Intentional public review-submission RPC; validates input and public shop visibility.';

commit;

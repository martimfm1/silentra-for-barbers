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

-- These functions are only invoked by database triggers/event triggers. They
-- must not be callable as standalone PostgREST RPCs by client roles.
revoke all on function public.ensure_shop_slug() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_user_subscription() from public, anon, authenticated;
revoke all on function public.handle_updated_at() from public, anon, authenticated;
revoke all on function public.handle_update_timestamp() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.protect_user_tenant_fields() from public, anon, authenticated;
revoke all on function public.record_marketplace_order_status_event() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.sync_shop_review_stats() from public, anon, authenticated;
revoke all on function public.notify_new_review() from public, anon, authenticated;
revoke all on function public.sync_barbershop_name_to_shops() from public, anon, authenticated;
revoke all on function public.sync_barbershop_phone_to_shops() from public, anon, authenticated;
revoke all on function public.sync_barbershop_address_to_shops() from public, anon, authenticated;
revoke all on function public.sync_barbershop_details_to_shops() from public, anon, authenticated;
revoke all on function public.sync_barbershop_to_shop() from public, anon, authenticated;
revoke all on function public.atualizar_receita_barbearia() from public, anon, authenticated;
revoke all on function public.guard_cancelled_marketing_campaign() from public, anon, authenticated;
revoke all on function public.touch_barbershop_billing_accounts_updated_at() from public, anon, authenticated;

-- These helpers are used by authenticated authorization/RLS checks. They
-- must not be callable by anon; keep authenticated and trusted server access.
revoke all on function public.get_my_barbershop_id() from public, anon;
grant execute on function public.get_my_barbershop_id() to authenticated, service_role;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke all on function public.complete_barbershop_onboarding(uuid) from public, anon;
grant execute on function public.complete_barbershop_onboarding(uuid) to authenticated, service_role;

revoke all on function public.set_barbershop_avatar_url(uuid, text) from public, anon;
grant execute on function public.set_barbershop_avatar_url(uuid, text) to authenticated, service_role;

-- Pin search_path for every function flagged by the production advisor. This
-- prevents object-shadowing through a caller-controlled schema.
alter function public.sync_barbershop_name_to_shops() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.sync_barbershop_phone_to_shops() set search_path = public;
alter function public.notify_new_review() set search_path = public;
alter function public.sync_barbershop_address_to_shops() set search_path = public;
alter function public.normalize_shop_slug(text) set search_path = public;
alter function public.atualizar_receita_barbearia() set search_path = public;
alter function public.sync_barbershop_to_shop() set search_path = public;
alter function public.create_professional_with_quota(uuid, uuid, text, numeric, boolean) set search_path = public;
alter function public.sync_barbershop_details_to_shops() set search_path = public;
alter function public.check_if_admin() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.handle_update_timestamp() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.touch_barbershop_billing_accounts_updated_at() set search_path = public;
alter function public.guard_cancelled_marketing_campaign() set search_path = public;
alter function public.marketplace_order_status_customer_message(text) set search_path = public;

-- Public review submission is intentionally callable without an account; its
-- RPC performs its own shop-visibility and input validation checks.
comment on function public.submit_public_review(uuid, text, integer, text)
  is 'Intentional public review-submission RPC; validates input and public shop visibility.';

commit;

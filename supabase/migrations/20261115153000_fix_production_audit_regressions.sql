begin;

-- Prevent anonymous execution of functions created in the exposed public schema
-- by either application migration owner. Existing functions are handled below;
-- this only changes defaults for functions created from now on.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
-- The supabase_admin role is not a member of the migration owner and its
-- defaults are managed by Supabase; do not attempt to alter its ACLs here.

-- Fix PL/pgSQL output-parameter/column collision: RETURNS TABLE exposes "role"
-- as an output variable, so the users column must always be qualified.
create or replace function public.join_barbershop_with_invite(p_code text)
returns table (barbershop_id uuid, role text)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user uuid := auth.uid();
  v_input text;
  v_hash text;
  v_invite public.barbershop_invite_codes%rowtype;
  v_default_permissions jsonb := jsonb_build_object(
    'dashboard', true, 'agenda', true, 'clients', true, 'services', true,
    'team', false, 'messages', false, 'marketing', false, 'loyalty', false,
    'automations', false, 'analytics', false, 'qr', false, 'settings', false, 'billing', false
  );
  v_plan text := 'free';
  v_limit integer := 1;
  v_active_count integer := 0;
  v_existing_professional boolean := false;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  v_input := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));

  if v_input ~ '^BARB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$' then
    null;
  elsif v_input ~ '^[0-9A-F]{10}$' then
    null;
  else
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.users as u
    where u.id = v_user
      and u.role = 'owner'
  ) then
    raise exception 'owner_cannot_join' using errcode = '42501';
  end if;

  v_hash := encode(digest(v_input, 'sha256'), 'hex');

  select *
    into v_invite
  from public.barbershop_invite_codes
  where code_hash = v_hash
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'invalid_or_expired_code' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.professionals
    where barbershop_id = v_invite.barbershop_id
      and user_id = v_user
  ) into v_existing_professional;

  if not v_existing_professional then
    perform pg_advisory_xact_lock(hashtextextended(v_invite.barbershop_id::text, 0));

    select coalesce(public.get_effective_billing_plan_for_barbershop(v_invite.barbershop_id), 'free')
      into v_plan;

    v_limit := case v_plan
      when 'free' then 1
      when 'pro' then 5
      when 'enterprise' then 2147483647
      else 1
    end;

    select count(*)::integer
      into v_active_count
    from public.professionals
    where barbershop_id = v_invite.barbershop_id
      and active = true;

    if v_active_count >= v_limit then
      raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
    end if;
  end if;

  perform set_config('app.silentra_invite_join', 'true', true);

  update public.users
  set barbershop_id = v_invite.barbershop_id,
      role = v_invite.role
  where id = v_user;

  if not found then
    raise exception 'user_profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.barbershop_member_permissions(user_id, barbershop_id, permissions, updated_at)
  values (v_user, v_invite.barbershop_id, v_default_permissions, now())
  on conflict (user_id) do update
    set barbershop_id = excluded.barbershop_id,
        permissions = excluded.permissions,
        updated_at = excluded.updated_at;

  perform public.sync_barber_professional(v_user, v_invite.barbershop_id, v_invite.role);

  update public.barbershop_invite_codes
  set used_at = now(),
      used_by = v_user
  where id = v_invite.id;

  return query select v_invite.barbershop_id, v_invite.role;
end;
$function$;

revoke all on function public.join_barbershop_with_invite(text)
  from public, anon, authenticated;
grant execute on function public.join_barbershop_with_invite(text)
  to authenticated;

-- The output column names in RETURNS TABLE are PL/pgSQL variables. Target the
-- existing unique constraint explicitly so ON CONFLICT cannot bind ambiguously.
create or replace function public.claim_subscription_expiry_reminder_events(
  p_batch_size integer default 100
)
returns table (
  id uuid,
  subscription_id uuid,
  period_end timestamptz,
  days_before smallint,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 100), 250));
begin
  insert into public.subscription_expiry_reminder_outbox (
    subscription_id,
    period_end,
    days_before
  )
  select
    s.id,
    s.current_period_end,
    reminder.days_before
  from public.subscriptions as s
  cross join (values (7::smallint), (3::smallint), (1::smallint)) as reminder(days_before)
  where s.barbershop_id is not null
    and s.plan in ('pro', 'enterprise')
    and s.status in ('active', 'trialing')
    and s.plan_override is null
    and s.current_period_end is not null
    and (
      s.payment_method = 'MANUAL'
      or (s.payment_method = 'STRIPE' and s.cancel_at_period_end = true)
    )
    and not exists (
      select 1
      from public.barbershop_plan_assignments as a
      where a.barbershop_id = s.barbershop_id
        and (a.expires_at is null or a.expires_at > pg_catalog.now())
    )
    and (s.current_period_end at time zone 'Europe/Lisbon')::date =
      ((pg_catalog.now() at time zone 'Europe/Lisbon')::date + reminder.days_before)
  on conflict on constraint subscription_expiry_reminder_outbox_once do nothing;

  update public.subscription_expiry_reminder_outbox as o
  set status = 'pending',
      locked_at = null,
      available_at = least(o.available_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where o.status = 'processing'
    and o.locked_at is not null
    and o.locked_at < pg_catalog.now() - interval '15 minutes';

  return query
  with candidates as (
    select o.id
    from public.subscription_expiry_reminder_outbox as o
    where o.status = 'pending'
      and o.available_at <= pg_catalog.now()
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit v_batch_size
  )
  update public.subscription_expiry_reminder_outbox as o
  set status = 'processing',
      locked_at = pg_catalog.now(),
      attempts = o.attempts + 1,
      updated_at = pg_catalog.now()
  from candidates as c
  where o.id = c.id
  returning o.id, o.subscription_id, o.period_end, o.days_before, o.attempts;
end;
$function$;

revoke all on function public.claim_subscription_expiry_reminder_events(integer)
  from public, anon, authenticated;
grant execute on function public.claim_subscription_expiry_reminder_events(integer)
  to service_role;

-- This RPC is used by the authenticated dashboard; anonymous execution is
-- never required. An empty search_path prevents object-shadowing attacks.
create or replace function public.set_manual_booking_auto_confirmation(
  p_barbershop_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null or p_enabled is null then
    raise exception 'invalid manual booking confirmation setting';
  end if;

  if not exists (
    select 1
    from public.users as u
    where u.id = auth.uid()
      and u.barbershop_id = p_barbershop_id
      and u.role in ('owner', 'admin')
  ) then
    raise exception 'barbershop update not permitted';
  end if;

  update public.barbershops
  set auto_confirm_manual_bookings = p_enabled,
      updated_at = pg_catalog.now()
  where id = p_barbershop_id;

  if not found then
    raise exception 'barbershop not found';
  end if;
end;
$function$;

revoke all on function public.set_manual_booking_auto_confirmation(uuid, boolean)
  from public, anon;
grant execute on function public.set_manual_booking_auto_confirmation(uuid, boolean)
  to authenticated;

-- Trigger functions are invoked by the trigger, not exposed as RPC endpoints.
-- Keep the trigger attached but remove direct client/API EXECUTE grants.
create or replace function public.apply_manual_booking_confirmation_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auto_confirm boolean;
begin
  if auth.uid() is not null and new.status in ('pending', 'scheduled') then
    select coalesce(b.auto_confirm_manual_bookings, true)
      into v_auto_confirm
    from public.barbershops as b
    where b.id = new.barbershop_id;

    if v_auto_confirm then
      new.status := 'scheduled';
    else
      new.status := 'pending';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.apply_manual_booking_confirmation_setting()
  from public, anon, authenticated, service_role;

-- No consumer exists for the legacy review notification queue in the current
-- application. Stop creating unprocessable rows; preserve existing rows for
-- future inspection/explicit migration.
drop trigger if exists trigger_notify_new_review on public.reviews;

notify pgrst, 'reload schema';

commit;

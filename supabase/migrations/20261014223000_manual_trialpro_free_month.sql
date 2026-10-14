-- TRIALPRO is a one-time, one-month Pro grant for genuinely new manual-billing
-- customers. Redemption is server-only and performed atomically with activation.
alter table public.subscription_requests
  drop constraint if exists subscription_requests_status_check;

alter table public.subscription_requests
  add constraint subscription_requests_status_check
    check (
      status in (
        'PENDING',
        'PAYMENT_SENT',
        'PAID',
        'TRIAL',
        'REJECTED',
        'EXPIRED',
        'CANCELLED'
      )
    );

create or replace function public.redeem_manual_pro_trial(
  p_request_id uuid,
  p_actor_user_id uuid
)
returns table (
  request_id uuid,
  subscription_id uuid,
  user_id uuid,
  barbershop_id uuid,
  plan text,
  billing_interval text,
  price numeric,
  currency text,
  started_at timestamptz,
  expires_at timestamptz,
  already_redeemed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.subscription_requests;
  v_subscription_id uuid;
  v_start timestamptz;
  v_expires timestamptz;
begin
  if p_request_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'TRIAL_REQUEST_INVALID';
  end if;

  select *
    into v_request
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRIAL_REQUEST_INVALID';
  end if;

  if v_request.user_id <> p_actor_user_id
     or v_request.plan <> 'pro'
     or v_request.billing_interval <> 'month'
     or v_request.promotion_code <> 'TRIALPRO'
     or v_request.price <> 0
     or v_request.original_price <= 0
     or v_request.discount_amount <> v_request.original_price then
    raise exception using errcode = 'P0001', message = 'TRIAL_REQUEST_INVALID';
  end if;

  if v_request.status = 'TRIAL' then
    return query
      select
        v_request.id,
        v_request.subscription_id,
        v_request.user_id,
        v_request.barbershop_id,
        v_request.plan,
        v_request.billing_interval,
        v_request.price,
        v_request.currency,
        v_request.started_at,
        v_request.expires_at,
        true;
    return;
  end if;

  if v_request.status <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'TRIAL_REQUEST_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_request.barbershop_id::text, 0)
  );

  -- Strict first-time checks are re-run under a transaction lock so preview
  -- validation cannot be raced or replayed by simultaneous checkout requests.
  if exists (
    select 1
    from public.subscriptions as s
    where s.user_id = v_request.user_id
       or s.barbershop_id = v_request.barbershop_id
  ) then
    raise exception using errcode = 'P0001', message = 'TRIAL_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.subscription_requests as r
    where r.user_id = v_request.user_id
      and r.id <> v_request.id
  ) then
    raise exception using errcode = 'P0001', message = 'TRIAL_HISTORY_EXISTS';
  end if;

  if exists (
    select 1
    from public.barbershop_billing_accounts as a
    where a.billing_owner_user_id = v_request.user_id
       or a.barbershop_id = v_request.barbershop_id
  ) or exists (
    select 1
    from public.customers as c
    where c.user_id = v_request.user_id
  ) then
    raise exception using errcode = 'P0001', message = 'TRIAL_HISTORY_EXISTS';
  end if;

  v_start := pg_catalog.now();
  v_expires := v_start + interval '1 month';

  insert into public.subscriptions (
    user_id,
    barbershop_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    plan,
    status,
    trial_end,
    current_period_end,
    cancel_at_period_end,
    payment_method,
    created_at,
    updated_at
  )
  values (
    v_request.user_id,
    v_request.barbershop_id,
    null,
    null,
    null,
    'pro',
    'trialing',
    v_expires,
    v_expires,
    false,
    'MANUAL',
    v_start,
    v_start
  )
  returning id into v_subscription_id;

  update public.subscription_requests
  set subscription_id = v_subscription_id,
      status = 'TRIAL',
      processed_at = v_start,
      started_at = v_start,
      expires_at = v_expires,
      notes = pg_catalog.concat_ws(
        E'\n',
        pg_catalog.nullif(pg_catalog.btrim(notes), ''),
        'TRIALPRO redeemed: one free Pro month; no payment collected.'
      ),
      updated_at = v_start
  where id = v_request.id;

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  values (
    'MANUAL_PRO_TRIAL_REDEEMED',
    'subscription_request',
    v_request.id::text,
    pg_catalog.jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'user_id', v_request.user_id,
      'barbershop_id', v_request.barbershop_id,
      'subscription_id', v_subscription_id,
      'promotion_code', 'TRIALPRO',
      'plan', 'pro',
      'duration_months', 1,
      'original_price', v_request.original_price,
      'discount_amount', v_request.discount_amount,
      'price', 0,
      'currency', 'EUR',
      'expires_at', v_expires
    ),
    v_start
  );

  return query
    select
      v_request.id,
      v_subscription_id,
      v_request.user_id,
      v_request.barbershop_id,
      v_request.plan,
      v_request.billing_interval,
      v_request.price,
      v_request.currency,
      v_start,
      v_expires,
      false;
end;
$$;

revoke all on function public.redeem_manual_pro_trial(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_manual_pro_trial(uuid, uuid)
  to service_role;

create or replace function public.expire_manual_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.subscriptions
    set plan = 'free',
        status = 'canceled',
        cancel_at_period_end = false,
        trial_end = null,
        updated_at = pg_catalog.now()
    where payment_method = 'MANUAL'
      and status in ('active', 'trialing')
      and plan in ('pro', 'enterprise')
      and current_period_end is not null
      and current_period_end <= pg_catalog.now()
    returning id, barbershop_id, current_period_end
  ),
  marked_requests as (
    update public.subscription_requests as r
    set status = 'EXPIRED',
        processed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where r.subscription_id in (select id from expired)
      and r.status in ('PAID', 'TRIAL')
      and r.expires_at is not null
      and r.expires_at <= pg_catalog.now()
    returning r.id, r.subscription_id
  )
  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  select
    'SUBSCRIPTION_EXPIRED',
    'subscription',
    e.id::text,
    pg_catalog.jsonb_build_object(
      'barbershop_id', e.barbershop_id,
      'expires_at', e.current_period_end
    ),
    pg_catalog.now()
  from expired e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_manual_subscriptions()
  from public, anon, authenticated;
grant execute on function public.expire_manual_subscriptions()
  to service_role;

notify pgrst, 'reload schema';

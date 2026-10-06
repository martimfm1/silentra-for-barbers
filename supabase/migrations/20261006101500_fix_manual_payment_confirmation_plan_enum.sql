-- Fix manual payment confirmation when subscriptions.plan is the
-- public.subscription_plan enum instead of text.
--
-- Keep the existing schema. Explicitly cast request plan data once and use
-- the typed enum for comparisons/inserts/updates.

create or replace function public.activate_manual_subscription_payment(
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
  already_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.subscription_requests;
  v_subscription public.subscriptions;
  v_other_user_subscription public.subscriptions;
  v_start timestamptz;
  v_expires timestamptz;
  v_subscription_id uuid;
  v_requested_plan public.subscription_plan;
begin
  if p_request_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'INVALID_CONFIRMATION_REQUEST';
  end if;

  select *
    into v_request
  from public.subscription_requests as sr
  where sr.id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SUBSCRIPTION_REQUEST_NOT_FOUND';
  end if;

  v_requested_plan := v_request.plan::public.subscription_plan;

  if v_request.status = 'PAID' then
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

  if v_request.status <> 'PAYMENT_SENT' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_READY_FOR_CONFIRMATION';
  end if;

  if v_request.payment_link is null or v_request.payment_sent_at is null then
    raise exception using errcode = 'P0001', message = 'PAYMENT_LINK_NOT_SENT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_request.barbershop_id::text, 0)
  );

  select *
    into v_subscription
  from public.subscriptions as s
  where s.barbershop_id = v_request.barbershop_id
  for update;

  if not found then
    select *
      into v_subscription
    from public.subscriptions as s
    where s.user_id = v_request.user_id
      and s.barbershop_id is null
    for update;
  end if;

  if v_subscription.id is null then
    select *
      into v_other_user_subscription
    from public.subscriptions as s
    where s.user_id = v_request.user_id
      and s.barbershop_id is not null
      and s.barbershop_id <> v_request.barbershop_id
    limit 1
    for update;

    if found then
      raise exception using errcode = '23505', message = 'USER_SUBSCRIPTION_TENANT_CONFLICT';
    end if;
  end if;

  if v_request.request_type = 'NEW'
     and v_subscription.id is not null
     and v_subscription.status in ('active', 'trialing')
     and v_subscription.plan in ('pro', 'enterprise') then
    if v_subscription.payment_method = 'STRIPE' then
      raise exception using errcode = '23505', message = 'ACTIVE_STRIPE_SUBSCRIPTION_EXISTS';
    end if;

    if v_subscription.payment_method = 'MANUAL' then
      raise exception using errcode = '23505', message = 'ACTIVE_MANUAL_SUBSCRIPTION_EXISTS';
    end if;
  end if;

  if v_request.request_type in ('RENEWAL', 'CHANGE')
     and (
       v_subscription.id is null
       or v_subscription.payment_method <> 'MANUAL'
       or v_subscription.plan = 'free'::public.subscription_plan
     ) then
    raise exception using errcode = 'P0001', message = 'MANUAL_SUBSCRIPTION_NOT_FOUND';
  end if;

  if v_request.request_type = 'CHANGE'
     and v_subscription.plan = v_requested_plan then
    raise exception using errcode = 'P0001', message = 'PLAN_ALREADY_ACTIVE';
  end if;

  if v_subscription.current_period_end is not null
     and v_subscription.current_period_end > now()
     and v_request.request_type = 'RENEWAL' then
    v_start := v_subscription.current_period_end;
  else
    v_start := now();
  end if;

  v_expires :=
    case v_request.billing_interval
      when 'year' then v_start + interval '1 year'
      else v_start + interval '1 month'
    end;

  if v_subscription.id is null then
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
      v_requested_plan,
      'active',
      null,
      v_expires,
      false,
      'MANUAL',
      now(),
      now()
    )
    returning id into v_subscription_id;
  else
    update public.subscriptions as s
    set user_id = v_request.user_id,
        barbershop_id = v_request.barbershop_id,
        stripe_customer_id = null,
        stripe_subscription_id = null,
        stripe_price_id = null,
        plan = v_requested_plan,
        status = 'active',
        trial_end = null,
        current_period_end = v_expires,
        cancel_at_period_end = false,
        payment_method = 'MANUAL',
        updated_at = now()
    where s.id = v_subscription.id
    returning id into v_subscription_id;
  end if;

  update public.subscription_requests as sr
  set subscription_id = v_subscription_id,
      status = 'PAID',
      paid_at = now(),
      processed_at = now(),
      started_at = v_start,
      expires_at = v_expires,
      last_email_error = null,
      updated_at = now()
  where sr.id = v_request.id;

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  values (
    'SUBSCRIPTION_ACTIVATED',
    'subscription',
    v_subscription_id::text,
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'user_id', v_request.user_id,
      'barbershop_id', v_request.barbershop_id,
      'request_id', v_request.id,
      'plan', v_request.plan,
      'billing_interval', v_request.billing_interval,
      'expires_at', v_expires
    ),
    now()
  );

  insert into public.audit_logs (
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  values (
    'PAYMENT_CONFIRMED',
    'subscription_request',
    v_request.id::text,
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'user_id', v_request.user_id,
      'barbershop_id', v_request.barbershop_id,
      'subscription_id', v_subscription_id,
      'plan', v_request.plan,
      'billing_interval', v_request.billing_interval,
      'price', v_request.price,
      'currency', v_request.currency,
      'request_type', v_request.request_type
    ),
    now()
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

revoke all on function public.activate_manual_subscription_payment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_manual_subscription_payment(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

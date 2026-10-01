-- Persistent global payment-mode selection plus manual subscription request history.
-- Manual payments must never require Stripe identifiers or Stripe API calls.

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value)
values ('payment_mode', 'MANUAL')
on conflict (key) do nothing;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  request_type text not null default 'NEW'
    check (request_type in ('NEW', 'RENEWAL', 'CHANGE')),
  plan text not null
    check (plan in ('pro', 'enterprise')),
  billing_interval text not null default 'month'
    check (billing_interval in ('month', 'year')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAYMENT_SENT', 'PAID', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  payment_method text not null default 'MANUAL'
    check (payment_method = 'MANUAL'),
  price numeric(10,2) not null
    check (price >= 0),
  currency text not null default 'EUR'
    check (currency = 'EUR'),
  payment_link text,
  payment_sent_at timestamptz,
  paid_at timestamptz,
  processed_at timestamptz,
  started_at timestamptz,
  expires_at timestamptz,
  last_email_error text,
  payment_email_message_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_requests_barbershop_idx
  on public.subscription_requests (barbershop_id, created_at desc);

create index if not exists subscription_requests_status_idx
  on public.subscription_requests (status, created_at desc);

create unique index if not exists subscription_requests_one_open_idx
  on public.subscription_requests (barbershop_id)
  where status in ('PENDING', 'PAYMENT_SENT');

alter table public.subscription_requests enable row level security;

drop policy if exists "Users can read their subscription requests"
  on public.subscription_requests;
create policy "Users can read their subscription requests"
  on public.subscription_requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

alter table public.subscriptions
  alter column stripe_customer_id drop not null;

alter table public.subscriptions
  add column if not exists payment_method text not null default 'STRIPE'
    check (payment_method in ('MANUAL', 'STRIPE'));

create index if not exists subscriptions_payment_method_idx
  on public.subscriptions (payment_method);

create or replace function public.touch_platform_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_platform_settings_updated_at
  on public.platform_settings;
create trigger trg_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.touch_platform_settings_updated_at();

create or replace function public.touch_subscription_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscription_requests_updated_at
  on public.subscription_requests;
create trigger trg_subscription_requests_updated_at
before update on public.subscription_requests
for each row execute function public.touch_subscription_requests_updated_at();

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
  v_start timestamptz;
  v_expires timestamptz;
  v_subscription_id uuid;
begin
  if p_request_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid confirmation request';
  end if;

  select *
    into v_request
  from public.subscription_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'SUBSCRIPTION_REQUEST_NOT_FOUND';
  end if;

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
    raise exception using errcode = '22023', message = 'PAYMENT_NOT_READY_FOR_CONFIRMATION';
  end if;

  if v_request.payment_link is null or v_request.payment_sent_at is null then
    raise exception using errcode = '22023', message = 'PAYMENT_LINK_NOT_SENT';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_request.barbershop_id::text, 0)
  );

  select *
    into v_subscription
  from public.subscriptions
  where barbershop_id = v_request.barbershop_id
  for update;

  if v_request.request_type = 'NEW'
     and v_subscription.id is not null
     and v_subscription.status in ('active', 'trialing')
     and v_subscription.plan in ('pro', 'enterprise')
     and v_subscription.payment_method = 'MANUAL' then
    raise exception using errcode = '23505', message = 'ACTIVE_MANUAL_SUBSCRIPTION_EXISTS';
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
      v_request.plan,
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
    update public.subscriptions
    set user_id = v_request.user_id,
        barbershop_id = v_request.barbershop_id,
        stripe_customer_id = null,
        stripe_subscription_id = null,
        stripe_price_id = null,
        plan = v_request.plan,
        status = 'active',
        trial_end = null,
        current_period_end = v_expires,
        cancel_at_period_end = false,
        payment_method = 'MANUAL',
        updated_at = now()
    where id = v_subscription.id
    returning id into v_subscription_id;
  end if;

  update public.subscription_requests
  set subscription_id = v_subscription_id,
      status = 'PAID',
      paid_at = now(),
      processed_at = now(),
      started_at = v_start,
      expires_at = v_expires,
      last_email_error = null,
      updated_at = now()
  where id = v_request.id;

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

create or replace function public.expire_manual_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.subscriptions
    set plan = 'free',
        status = 'canceled',
        cancel_at_period_end = false,
        updated_at = now()
    where payment_method = 'MANUAL'
      and status = 'active'
      and plan in ('pro', 'enterprise')
      and current_period_end is not null
      and current_period_end <= now()
    returning id, barbershop_id, current_period_end
  ),
  marked_requests as (
    update public.subscription_requests r
    set status = 'EXPIRED',
        processed_at = now(),
        updated_at = now()
    where r.subscription_id in (select id from expired)
      and r.status = 'PAID'
      and r.expires_at is not null
      and r.expires_at <= now()
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
    jsonb_build_object(
      'barbershop_id', e.barbershop_id,
      'expires_at', e.current_period_end
    ),
    now()
  from expired e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_manual_subscriptions()
  from public, anon, authenticated;
grant execute on function public.expire_manual_subscriptions()
  to service_role;

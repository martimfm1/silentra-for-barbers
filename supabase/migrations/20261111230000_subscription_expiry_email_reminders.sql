-- Idempotent email reminders for paid subscriptions reaching their period end.
-- The worker creates the 7/3/1-day entries and claims them in one transaction.

create table if not exists public.subscription_expiry_reminder_outbox (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_end timestamptz not null,
  days_before smallint not null check (days_before in (7, 3, 1)),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  email_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_expiry_reminder_outbox_once
    unique (subscription_id, period_end, days_before)
);

create index if not exists subscription_expiry_reminder_outbox_pending_idx
  on public.subscription_expiry_reminder_outbox (available_at, created_at)
  where status = 'pending';

alter table public.subscription_expiry_reminder_outbox enable row level security;
revoke all on public.subscription_expiry_reminder_outbox
  from public, anon, authenticated;
grant all privileges on public.subscription_expiry_reminder_outbox
  to service_role;

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
  on conflict (subscription_id, period_end, days_before) do nothing;

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

notify pgrst, 'reload schema';

-- Reliable, idempotent delivery of confirmed Silentra platform subscription revenue to MoneyFlow.
-- Existing billing documents are intentionally not backfilled; only new confirmations are queued.

create table if not exists public.moneyflow_sync_credentials (
  integration_key text primary key check (integration_key = 'silentra-platform'),
  sync_token text not null,
  account_name text not null,
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'connected'
    check (status in ('connected', 'disconnected')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.moneyflow_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null default 'subscription_payment'
    check (event_type = 'subscription_payment'),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moneyflow_sync_outbox_ready_idx
  on public.moneyflow_sync_outbox(status, available_at, created_at)
  where status in ('pending', 'processing');

alter table public.moneyflow_sync_credentials enable row level security;
alter table public.moneyflow_sync_outbox enable row level security;

revoke all on public.moneyflow_sync_credentials
  from public, anon, authenticated;
revoke all on public.moneyflow_sync_outbox
  from public, anon, authenticated;
grant all on public.moneyflow_sync_credentials to service_role;
grant all on public.moneyflow_sync_outbox to service_role;

create or replace function public.enqueue_moneyflow_manual_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_key text;
begin
  if new.document_type <> 'PAYMENT_RECEIPT'
    or new.payment_method <> 'MANUAL'
    or new.total <= 0
    or new.currency !~ '^[A-Za-z]{3}$' then
    return new;
  end if;

  v_event_key := 'manual-payment:' || new.manual_request_id::text;

  insert into public.moneyflow_sync_outbox (
    event_key,
    event_type,
    payload
  )
  values (
    v_event_key,
    'subscription_payment',
    pg_catalog.jsonb_build_object(
      'eventId', v_event_key,
      'amount', new.total,
      'currency', pg_catalog.upper(new.currency),
      'occurredAt', new.issued_at,
      'description', pg_catalog.left(new.description, 160),
      'externalReference', new.document_number
    )
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_moneyflow_manual_payment()
  from public, anon, authenticated;

drop trigger if exists billing_documents_enqueue_moneyflow
  on public.billing_documents;

create trigger billing_documents_enqueue_moneyflow
after insert on public.billing_documents
for each row
execute function public.enqueue_moneyflow_manual_payment();

create or replace function public.claim_moneyflow_sync_events(
  p_batch_size integer default 50
)
returns table (
  id uuid,
  event_key text,
  payload jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_size, 50), 100));
begin
  return query
  with candidates as (
    select o.id
    from public.moneyflow_sync_outbox o
    where (
      (o.status = 'pending' and o.available_at <= now())
      or
      (o.status = 'processing' and o.locked_at < now() - interval '15 minutes')
    )
      and o.attempts < 10
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit v_limit
  ),
  claimed as (
    update public.moneyflow_sync_outbox o
    set status = 'processing',
        attempts = o.attempts + 1,
        locked_at = now(),
        updated_at = now()
    from candidates c
    where o.id = c.id
    returning o.id, o.event_key, o.payload, o.attempts
  )
  select c.id, c.event_key, c.payload, c.attempts
  from claimed c;
end;
$$;

revoke all on function public.claim_moneyflow_sync_events(integer)
  from public, anon, authenticated;
grant execute on function public.claim_moneyflow_sync_events(integer)
  to service_role;

notify pgrst, 'reload schema';

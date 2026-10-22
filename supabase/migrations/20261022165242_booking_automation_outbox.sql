begin;

create table if not exists public.booking_automation_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  client_id uuid null references public.users(id) on delete set null,
  event_type text not null default 'booking_completed'
    check (event_type = 'booking_completed'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (appointment_id, event_type)
);

create index if not exists booking_automation_outbox_ready_idx
  on public.booking_automation_outbox (available_at, created_at)
  where status in ('pending', 'failed');

create index if not exists booking_automation_outbox_shop_idx
  on public.booking_automation_outbox (barbershop_id, created_at desc);

alter table public.booking_automation_outbox enable row level security;
revoke all on public.booking_automation_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.booking_automation_outbox to service_role;

create or replace function public.enqueue_booking_completed_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    insert into public.booking_automation_outbox (
      appointment_id, barbershop_id, client_id, event_type
    )
    values (
      new.id, new.barbershop_id, new.client_id, 'booking_completed'
    )
    on conflict (appointment_id, event_type) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_booking_completed_automation() from public, anon, authenticated;

drop trigger if exists appointments_enqueue_booking_completed_automation
  on public.appointments;
create trigger appointments_enqueue_booking_completed_automation
after update of status on public.appointments
for each row
when (new.status = 'completed' and old.status is distinct from new.status)
execute function public.enqueue_booking_completed_automation();

create or replace function public.claim_booking_automation_events(p_batch_size integer default 100)
returns table (
  id uuid,
  appointment_id uuid,
  barbershop_id uuid,
  client_id uuid,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select o.id
    from public.booking_automation_outbox o
    where o.status in ('pending', 'failed')
      and o.available_at <= now()
      and o.attempts < 10
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 100), 250))
  )
  update public.booking_automation_outbox o
  set status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      updated_at = now(),
      last_error = null
  from candidates c
  where o.id = c.id
  returning o.id, o.appointment_id, o.barbershop_id, o.client_id, o.attempts;
end;
$$;

revoke all on function public.claim_booking_automation_events(integer) from public, anon, authenticated;
grant execute on function public.claim_booking_automation_events(integer) to service_role;

-- Recover leases if a worker dies while processing. Retries are delayed with
-- exponential backoff in the worker, and old processing leases are recoverable.
create or replace function public.recover_stale_booking_automation_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.booking_automation_outbox
  set status = case when attempts >= 10 then 'failed' else 'pending' end,
      available_at = now() + interval '1 minute',
      locked_at = null,
      last_error = coalesce(last_error, 'Worker lease expired'),
      updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '15 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.recover_stale_booking_automation_events() from public, anon, authenticated;
grant execute on function public.recover_stale_booking_automation_events() to service_role;

commit;

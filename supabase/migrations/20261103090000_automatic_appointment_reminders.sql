begin;

create table if not exists public.appointment_reminder_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists appointment_reminder_outbox_idempotency_idx
  on public.appointment_reminder_outbox (appointment_id, scheduled_for)
  where status <> 'cancelled';

create index if not exists appointment_reminder_outbox_ready_idx
  on public.appointment_reminder_outbox (available_at, created_at)
  where status = 'pending';

create index if not exists appointment_reminder_outbox_shop_idx
  on public.appointment_reminder_outbox (barbershop_id, scheduled_for desc);

alter table public.appointment_reminder_outbox enable row level security;
revoke all on public.appointment_reminder_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.appointment_reminder_outbox to service_role;

create or replace function public.enqueue_appointment_reminder(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_enabled boolean;
  v_plan text;
  v_due_at timestamptz;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if not found then
    return;
  end if;

  update public.appointment_reminder_outbox
  set status = 'cancelled',
      updated_at = now(),
      locked_at = null
  where appointment_id = p_appointment_id
    and status in ('pending', 'processing')
    and scheduled_for is distinct from (v_appointment.date_hour - interval '24 hours');

  select b.auto_reminders
  into v_enabled
  from public.barbershops b
  where b.id = v_appointment.barbershop_id;

  if v_appointment.status <> 'scheduled'
     or coalesce(v_enabled, false) is not true
     or v_appointment.date_hour <= now() + interval '24 hours' then
    update public.appointment_reminder_outbox
    set status = 'cancelled', updated_at = now(), locked_at = null
    where appointment_id = p_appointment_id
      and status in ('pending', 'processing');
    return;
  end if;

  select public.get_effective_billing_plan_for_barbershop(v_appointment.barbershop_id)
  into v_plan;

  if coalesce(v_plan, 'free') not in ('pro', 'enterprise') then
    return;
  end if;

  v_due_at := v_appointment.date_hour - interval '24 hours';
  insert into public.appointment_reminder_outbox (
    appointment_id, barbershop_id, scheduled_for, available_at
  ) values (
    v_appointment.id, v_appointment.barbershop_id, v_due_at, v_due_at
  )
  on conflict (appointment_id, scheduled_for) where status <> 'cancelled' do nothing;
end;
$$;

revoke all on function public.enqueue_appointment_reminder(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_appointment_reminder(uuid) to service_role;

create or replace function public.sync_appointment_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_appointment_reminder(new.id);
  return new;
end;
$$;

revoke all on function public.sync_appointment_reminder() from public, anon, authenticated;

drop trigger if exists appointments_sync_reminder on public.appointments;
create trigger appointments_sync_reminder
after insert or update of date_hour, status, client_id, manual_email, manual_name, service_id, professional_id
on public.appointments
for each row execute function public.sync_appointment_reminder();

create or replace function public.sync_barbershop_appointment_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id uuid;
begin
  if new.auto_reminders is true then
    for v_appointment_id in
      select a.id
      from public.appointments a
      where a.barbershop_id = new.id
        and a.status = 'scheduled'
        and a.date_hour > now() + interval '24 hours'
    loop
      perform public.enqueue_appointment_reminder(v_appointment_id);
    end loop;
  else
    update public.appointment_reminder_outbox
    set status = 'cancelled', updated_at = now(), locked_at = null
    where barbershop_id = new.id
      and status in ('pending', 'processing');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_barbershop_appointment_reminders() from public, anon, authenticated;

drop trigger if exists barbershops_sync_appointment_reminders on public.barbershops;
create trigger barbershops_sync_appointment_reminders
after update of auto_reminders on public.barbershops
for each row
when (old.auto_reminders is distinct from new.auto_reminders)
execute function public.sync_barbershop_appointment_reminders();

-- Keep the Pro/Enterprise restriction server-side even if a client calls the
-- settings RPC directly instead of using the dashboard feature gate.
create or replace function public.enforce_appointment_reminders_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  if new.auto_reminders is true then
    select public.get_effective_billing_plan_for_barbershop(new.id) into v_plan;
    if coalesce(v_plan, 'free') not in ('pro', 'enterprise') then
      raise exception using
        errcode = '42501',
        message = 'AUTOMATED_REMINDERS_PRO_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_appointment_reminders_plan() from public, anon, authenticated;

drop trigger if exists barbershops_enforce_appointment_reminders_plan on public.barbershops;
create trigger barbershops_enforce_appointment_reminders_plan
before insert or update of auto_reminders on public.barbershops
for each row execute function public.enforce_appointment_reminders_plan();

create or replace function public.claim_appointment_reminder_events(p_batch_size integer default 100)
returns table (
  id uuid,
  appointment_id uuid,
  barbershop_id uuid,
  scheduled_for timestamptz,
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
    from public.appointment_reminder_outbox o
    where o.status = 'pending'
      and o.available_at <= now()
      and o.attempts < 8
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 100), 250))
  )
  update public.appointment_reminder_outbox o
  set status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      updated_at = now(),
      last_error = null
  from candidates c
  where o.id = c.id
  returning o.id, o.appointment_id, o.barbershop_id, o.scheduled_for, o.attempts;
end;
$$;

revoke all on function public.claim_appointment_reminder_events(integer) from public, anon, authenticated;
grant execute on function public.claim_appointment_reminder_events(integer) to service_role;

create or replace function public.recover_stale_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.appointment_reminder_outbox
  set status = case when attempts >= 8 then 'failed' else 'pending' end,
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

revoke all on function public.recover_stale_appointment_reminders() from public, anon, authenticated;
grant execute on function public.recover_stale_appointment_reminders() to service_role;

commit;

-- Tenant-scoped activity history for appointment lifecycle events.
alter table public.audit_logs
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists actor_id uuid,
  add column if not exists actor_type text not null default 'system',
  add column if not exists actor_name text;

-- Backfill existing appointment audit events without exposing customer email metadata.
update public.audit_logs as log
set
  barbershop_id = appointment.barbershop_id,
  actor_id = case
    when coalesce(log.metadata->>'actorId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (log.metadata->>'actorId')::uuid
    else null
  end,
  actor_type = case
    when log.action like 'customer_portal_%' then 'customer'
    when log.metadata ? 'actorId' then 'staff'
    else 'system'
  end,
  actor_name = case
    when log.action like 'customer_portal_%' then 'Cliente'
    when log.metadata ? 'actorId' then null
    else 'Sistema'
  end
from public.appointments as appointment
where log.entity_type = 'appointment'
  and log.entity_id = appointment.id::text
  and log.barbershop_id is null;

-- Give older appointments a visible starting point without inventing a status-change time.
insert into public.audit_logs (
  action, entity_type, entity_id, barbershop_id,
  actor_type, actor_name, metadata, created_at
)
select
  'appointment.created',
  'appointment',
  appointment.id::text,
  appointment.barbershop_id,
  'system',
  'Registo anterior',
  jsonb_build_object('statusSnapshot', appointment.status::text),
  coalesce(appointment.created_at, now())
from public.appointments as appointment
where not exists (
  select 1
  from public.audit_logs as existing
  where existing.entity_type = 'appointment'
    and existing.entity_id = appointment.id::text
    and existing.action = 'appointment.created'
);

-- Recover historic cancellations from the cancellation fields already stored on appointments.
insert into public.audit_logs (
  action, entity_type, entity_id, barbershop_id,
  actor_type, actor_name, metadata, created_at
)
select
  'appointment.cancelled',
  'appointment',
  appointment.id::text,
  appointment.barbershop_id,
  case
    when appointment.cancellation_actor = 'customer' then 'customer'
    when appointment.cancellation_actor = 'staff' then 'staff'
    else 'system'
  end,
  coalesce(
    nullif(btrim(appointment.cancellation_actor_name), ''),
    case
      when appointment.cancellation_actor = 'customer' then 'Cliente'
      when appointment.cancellation_actor = 'staff' then 'Equipa da barbearia'
      else 'Sistema'
    end
  ),
  jsonb_build_object(
    'newStatus', 'cancelled',
    'reason', appointment.cancellation_reason
  ),
  appointment.cancelled_at
from public.appointments as appointment
where appointment.status::text = 'cancelled'
  and appointment.cancelled_at is not null
  and not exists (
    select 1
    from public.audit_logs as existing
    where existing.entity_type = 'appointment'
      and existing.entity_id = appointment.id::text
      and existing.action in ('appointment.cancelled', 'customer_portal_cancel')
  );

create index if not exists audit_logs_appointment_timeline_idx
  on public.audit_logs (barbershop_id, entity_id, created_at asc)
  where entity_type = 'appointment';

alter table public.audit_logs enable row level security;

-- Keep the audit table server-only. The guarded activity API performs
-- explicit tenant and agenda-permission checks before using the service role.
drop policy if exists "Barbershop members can read appointment activity" on public.audit_logs;
revoke all on table public.audit_logs from public, anon, authenticated;

-- Activity records are written and read only by trusted server routes.

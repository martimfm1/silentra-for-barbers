-- Tenant-scoped activity history for appointment lifecycle events.
alter table public.audit_logs
  add column if not exists barbershop_id uuid references public.barbershops(id) on delete cascade,
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
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

create index if not exists audit_logs_appointment_timeline_idx
  on public.audit_logs (barbershop_id, entity_id, created_at asc)
  where entity_type = 'appointment';

alter table public.audit_logs enable row level security;

drop policy if exists "Barbershop members can read appointment activity" on public.audit_logs;
create policy "Barbershop members can read appointment activity"
  on public.audit_logs
  for select
  to authenticated
  using (
    entity_type = 'appointment'
    and barbershop_id is not null
    and barbershop_id = public.current_barbershop_id()
  );

-- Activity records are written only by trusted server routes using service role.

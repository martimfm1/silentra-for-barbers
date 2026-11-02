begin;

-- Keep UPDATE tenant-scoped without rejecting legacy appointments whose
-- existing service/client/professional links predate current CRM invariants.
drop policy if exists appointments_staff_update_tenant on public.appointments;

create policy appointments_staff_update_tenant
  on public.appointments
  for update
  to authenticated
  using (
    public.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  )
  with check (
    public.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

-- Enforce reference integrity only when a protected reference is changed.
-- This avoids breaking harmless updates to old rows while preventing a caller
-- from attaching a booking in one tenant to another tenant's records.
create or replace function public.validate_appointment_tenant_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.barbershop_id is distinct from old.barbershop_id then
    raise exception using
      errcode = '42501',
      message = 'APPOINTMENT_TENANT_IMMUTABLE';
  end if;

  if new.service_id is distinct from old.service_id and new.service_id is not null then
    if not exists (
      select 1
      from public.services as service
      where service.id = new.service_id
        and service.barbershop_id = new.barbershop_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'APPOINTMENT_SERVICE_TENANT_MISMATCH';
    end if;
  end if;

  if new.professional_id is distinct from old.professional_id and new.professional_id is not null then
    if not exists (
      select 1
      from public.professionals as professional
      where professional.id = new.professional_id
        and professional.barbershop_id = new.barbershop_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'APPOINTMENT_PROFESSIONAL_TENANT_MISMATCH';
    end if;
  end if;

  if new.client_id is distinct from old.client_id and new.client_id is not null then
    if not exists (
      select 1
      from public.users as client
      where client.id = new.client_id
        and client.barbershop_id = new.barbershop_id
        and client.role = 'client'
    ) then
      raise exception using
        errcode = '42501',
        message = 'APPOINTMENT_CLIENT_TENANT_MISMATCH';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_appointment_tenant_references()
  from public, anon, authenticated;

drop trigger if exists validate_appointment_tenant_references
  on public.appointments;

create trigger validate_appointment_tenant_references
before update of barbershop_id, service_id, professional_id, client_id
on public.appointments
for each row
execute function public.validate_appointment_tenant_references();

-- Agenda operators necessarily need the client identity displayed next to
-- an appointment. CRM-only details remain protected by the same tenant check.
drop policy if exists users_read_self_or_authorized_tenant on public.users;

create policy users_read_self_or_authorized_tenant
  on public.users
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      role = 'client'
      and public.has_barbershop_permission(
        barbershop_id,
        array['clients', 'agenda', 'appointments']::text[]
      )
    )
    or (
      role in ('owner', 'admin', 'manager', 'barber', 'receptionist', 'staff')
      and public.has_barbershop_permission(
        barbershop_id,
        array['team', 'manage_professionals', 'professionals']::text[]
      )
    )
  );

notify pgrst, 'reload schema';

commit;

begin;

-- This schema is intentionally not exposed through the Supabase Data API.
-- RLS policies can call the function, while clients cannot invoke it as an RPC.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_barbershop_permission(
  p_barbershop_id uuid,
  p_permission_keys text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.users as actor
      where actor.id = (select auth.uid())
        and actor.barbershop_id = p_barbershop_id
        and lower(coalesce(actor.role, '')) = 'owner'
    )
    or exists (
      select 1
      from public.users as actor
      join public.barbershop_member_permissions as permissions
        on permissions.user_id = actor.id
       and permissions.barbershop_id = actor.barbershop_id
      where actor.id = (select auth.uid())
        and actor.barbershop_id = p_barbershop_id
        and lower(coalesce(actor.role, '')) in (
          'admin', 'manager', 'barber', 'receptionist', 'staff'
        )
        and exists (
          select 1
          from pg_catalog.unnest(
            coalesce(p_permission_keys, array[]::text[])
          ) as requested(permission_key)
          where permissions.permissions ->> requested.permission_key = 'true'
        )
    )
    or exists (
      select 1
      from public.users as actor
      where actor.id = (select auth.uid())
        and actor.barbershop_id = p_barbershop_id
        and lower(coalesce(actor.role, '')) in (
          'admin', 'manager', 'barber', 'receptionist', 'staff'
        )
        and not exists (
          select 1
          from public.barbershop_member_permissions as permissions
          where permissions.user_id = actor.id
            and permissions.barbershop_id = actor.barbershop_id
        )
        and exists (
          select 1
          from public.staff_permissions as legacy
          where legacy.user_id = actor.id
            and legacy.barbershop_id = actor.barbershop_id
            and legacy.permission = any(
              coalesce(p_permission_keys, array[]::text[])
            )
            and legacy.allowed = true
        )
    );
$function$;

revoke all on function private.has_barbershop_permission(uuid, text[])
  from public, anon, authenticated;
grant execute on function private.has_barbershop_permission(uuid, text[])
  to authenticated, service_role;

-- Replace policy dependencies before removing the old public RPC.
drop policy if exists appointments_staff_read_tenant on public.appointments;
drop policy if exists appointments_staff_insert_tenant on public.appointments;
drop policy if exists appointments_staff_update_tenant on public.appointments;
drop policy if exists appointments_staff_delete_tenant on public.appointments;

create policy appointments_staff_read_tenant
  on public.appointments for select to authenticated
  using (
    private.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

create policy appointments_staff_insert_tenant
  on public.appointments for insert to authenticated
  with check (
    private.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
    and status in ('pending', 'scheduled')
    and exists (
      select 1 from public.services as service
      where service.id = service_id
        and service.barbershop_id = appointments.barbershop_id
    )
    and (
      professional_id is null
      or exists (
        select 1 from public.professionals as professional
        where professional.id = professional_id
          and professional.barbershop_id = appointments.barbershop_id
          and professional.active = true
      )
    )
    and (
      client_id is null
      or exists (
        select 1 from public.users as client
        where client.id = appointments.client_id
          and client.barbershop_id = appointments.barbershop_id
          and client.role = 'client'
      )
    )
  );

create policy appointments_staff_update_tenant
  on public.appointments for update to authenticated
  using (
    private.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  )
  with check (
    private.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

create policy appointments_staff_delete_tenant
  on public.appointments for delete to authenticated
  using (
    private.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

drop policy if exists users_read_self_or_authorized_tenant on public.users;
drop policy if exists users_insert_client_in_tenant on public.users;
drop policy if exists users_update_self_or_client_in_tenant on public.users;
drop policy if exists users_delete_client_in_tenant on public.users;

create policy users_read_self_or_authorized_tenant
  on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or (
      role = 'client'
      and private.has_barbershop_permission(
        barbershop_id,
        array['clients', 'agenda', 'appointments']::text[]
      )
    )
    or (
      role in ('owner', 'admin', 'manager', 'barber', 'receptionist', 'staff')
      and private.has_barbershop_permission(
        barbershop_id,
        array['team', 'manage_professionals', 'professionals']::text[]
      )
    )
  );

create policy users_insert_client_in_tenant
  on public.users for insert to authenticated
  with check (
    role = 'client'
    and private.has_barbershop_permission(
      barbershop_id,
      array['clients']::text[]
    )
  );

create policy users_update_self_or_client_in_tenant
  on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or (
      role = 'client'
      and private.has_barbershop_permission(
        barbershop_id,
        array['clients']::text[]
      )
    )
  )
  with check (
    id = (select auth.uid())
    or (
      role = 'client'
      and private.has_barbershop_permission(
        barbershop_id,
        array['clients']::text[]
      )
    )
  );

create policy users_delete_client_in_tenant
  on public.users for delete to authenticated
  using (
    role = 'client'
    and private.has_barbershop_permission(
      barbershop_id,
      array['clients']::text[]
    )
  );

drop function if exists public.has_barbershop_permission(uuid, text[]);

notify pgrst, 'reload schema';

commit;

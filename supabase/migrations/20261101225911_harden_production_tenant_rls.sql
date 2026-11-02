begin;

-- Centralize permission checks for policies that need to read server-managed
-- team-permission tables. The caller identity always comes from auth.uid();
-- no caller-supplied user ID is accepted.
create or replace function public.has_barbershop_permission(
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

revoke all on function public.has_barbershop_permission(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.has_barbershop_permission(uuid, text[])
  to authenticated, service_role;

comment on function public.has_barbershop_permission(uuid, text[]) is
  'RLS helper: resolves the caller from auth.uid(), checks tenant membership, and uses canonical team permissions with legacy fallback only when no canonical row exists.';

-- Appointments contain private contact and booking information. The public
-- booking flow uses /api/bookings + the service-role-only atomic RPC; direct
-- anonymous Data API access is not part of the supported contract.
revoke all privileges on table public.appointments from anon;
grant select, insert, update, delete on table public.appointments to authenticated;
alter table public.appointments enable row level security;

do $policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
  loop
    execute format(
      'drop policy if exists %I on public.appointments',
      existing_policy.policyname
    );
  end loop;
end;
$policies$;

create policy appointments_staff_read_tenant
  on public.appointments
  for select
  to authenticated
  using (
    public.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

create policy appointments_staff_insert_tenant
  on public.appointments
  for insert
  to authenticated
  with check (
    public.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
    and status in ('pending', 'scheduled')
    and exists (
      select 1
      from public.services as service
      where service.id = service_id
        and service.barbershop_id = appointments.barbershop_id
    )
    and (
      professional_id is null
      or exists (
        select 1
        from public.professionals as professional
        where professional.id = professional_id
          and professional.barbershop_id = appointments.barbershop_id
          and professional.active = true
      )
    )
    and (
      client_id is null
      or exists (
        select 1
        from public.users as client
        where client.id = appointments.client_id
          and client.barbershop_id = appointments.barbershop_id
          and client.role = 'client'
      )
    )
  );

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
    and exists (
      select 1
      from public.services as service
      where service.id = service_id
        and service.barbershop_id = appointments.barbershop_id
    )
    and (
      professional_id is null
      or exists (
        select 1
        from public.professionals as professional
        where professional.id = professional_id
          and professional.barbershop_id = appointments.barbershop_id
      )
    )
    and (
      client_id is null
      or exists (
        select 1
        from public.users as client
        where client.id = appointments.client_id
          and client.barbershop_id = appointments.barbershop_id
          and client.role = 'client'
      )
    )
  );

create policy appointments_staff_delete_tenant
  on public.appointments
  for delete
  to authenticated
  using (
    public.has_barbershop_permission(
      barbershop_id,
      array['agenda', 'appointments']::text[]
    )
  );

-- Users is both the account-profile table and the tenant-scoped CRM client
-- table. Anonymous callers must never access it. Authenticated users may only
-- update safe profile/CRM fields; role, tenant, id and created_at are immutable
-- through the client Data API.
revoke all privileges on table public.users from anon;
revoke all privileges on table public.users from authenticated;
grant select, delete on table public.users to authenticated;
grant insert (
  barbershop_id,
  name_complete,
  num_phone,
  email,
  style_notes,
  role,
  name,
  birth_date
) on table public.users to authenticated;
grant update (
  name_complete,
  num_phone,
  email,
  style_notes,
  name,
  birth_date
) on table public.users to authenticated;
alter table public.users enable row level security;

do $policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'users'
  loop
    execute format(
      'drop policy if exists %I on public.users',
      existing_policy.policyname
    );
  end loop;
end;
$policies$;

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
        array['clients']::text[]
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

create policy users_insert_client_in_tenant
  on public.users
  for insert
  to authenticated
  with check (
    role = 'client'
    and public.has_barbershop_permission(
      barbershop_id,
      array['clients']::text[]
    )
  );

create policy users_update_self_or_client_in_tenant
  on public.users
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or (
      role = 'client'
      and public.has_barbershop_permission(
        barbershop_id,
        array['clients']::text[]
      )
    )
  )
  with check (
    id = (select auth.uid())
    or (
      role = 'client'
      and public.has_barbershop_permission(
        barbershop_id,
        array['clients']::text[]
      )
    )
  );

create policy users_delete_client_in_tenant
  on public.users
  for delete
  to authenticated
  using (
    role = 'client'
    and public.has_barbershop_permission(
      barbershop_id,
      array['clients']::text[]
    )
  );

-- Barbershop reads remain public for the public storefront and booking flow.
-- Writes are limited to an owner/admin of that exact tenant.
alter table public.barbershops enable row level security;

do $policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'barbershops'
  loop
    execute format(
      'drop policy if exists %I on public.barbershops',
      existing_policy.policyname
    );
  end loop;
end;
$policies$;

create policy barbershops_public_read
  on public.barbershops
  for select
  to anon, authenticated
  using (true);

create policy barbershops_creator_insert
  on public.barbershops
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy barbershops_owner_admin_update
  on public.barbershops
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users as actor
      where actor.id = (select auth.uid())
        and actor.barbershop_id = barbershops.id
        and actor.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.users as actor
      where actor.id = (select auth.uid())
        and actor.barbershop_id = barbershops.id
        and actor.role in ('owner', 'admin')
    )
  );

-- Fail the migration if the key database-level privilege boundaries are not
-- actually in place. This complements application-level QA contracts.
do $verification$
begin
  if has_table_privilege('anon', 'public.appointments', 'select')
    or has_table_privilege('anon', 'public.appointments', 'insert')
    or has_table_privilege('anon', 'public.appointments', 'update')
    or has_table_privilege('anon', 'public.appointments', 'delete') then
    raise exception 'SECURITY_ASSERTION_FAILED: anon still has appointment table privileges';
  end if;

  if has_table_privilege('anon', 'public.users', 'select')
    or has_table_privilege('anon', 'public.users', 'insert')
    or has_table_privilege('anon', 'public.users', 'update')
    or has_table_privilege('anon', 'public.users', 'delete') then
    raise exception 'SECURITY_ASSERTION_FAILED: anon still has users table privileges';
  end if;

  if has_column_privilege('authenticated', 'public.users', 'role', 'update')
    or has_column_privilege('authenticated', 'public.users', 'barbershop_id', 'update')
    or has_column_privilege('authenticated', 'public.users', 'id', 'update') then
    raise exception 'SECURITY_ASSERTION_FAILED: authenticated can still update protected account columns';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
      and roles @> array['anon']::name[]
  ) then
    raise exception 'SECURITY_ASSERTION_FAILED: anonymous appointment policy remains';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'barbershops'
      and cmd = 'UPDATE'
      and roles @> array['public']::name[]
  ) then
    raise exception 'SECURITY_ASSERTION_FAILED: public barbershop update policy remains';
  end if;
end;
$verification$;

notify pgrst, 'reload schema';

commit;

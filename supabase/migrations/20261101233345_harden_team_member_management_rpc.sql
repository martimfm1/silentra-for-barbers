begin;

-- Team membership mutations are owner-only. The previous SECURITY DEFINER
-- functions let admins/managers with the team permission change roles and
-- permissions, including their own, which could be used to escalate access.
create or replace function public.update_barbershop_member(
  p_user_id uuid,
  p_role text,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_shop uuid;
  v_actor_role text;
  v_old_role text;
  v_permissions jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select u.barbershop_id, lower(coalesce(u.role, ''))
    into v_shop, v_actor_role
    from public.users as u
   where u.id = v_actor;

  if v_shop is null or v_actor_role <> 'owner' then
    raise exception 'team_permission_required' using errcode = '42501';
  end if;

  select lower(coalesce(u.role, ''))
    into v_old_role
    from public.users as u
   where u.id = p_user_id
     and u.barbershop_id = v_shop
   for update;

  if v_old_role is null then
    raise exception 'member_not_found' using errcode = '22023';
  end if;
  if v_old_role = 'owner' then
    raise exception 'owner_role_is_immutable' using errcode = '42501';
  end if;
  if v_old_role = 'client' then
    raise exception 'clients_are_not_team_members' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('admin', 'manager', 'barber', 'receptionist', 'staff') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if p_permissions is not null and jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'invalid_permissions' using errcode = '22023';
  end if;

  v_permissions := coalesce(p_permissions, '{}'::jsonb);
  if exists (
    select 1
      from jsonb_each(v_permissions) as permission_entry(key, value)
     where jsonb_typeof(permission_entry.value) <> 'boolean'
  ) then
    raise exception 'invalid_permissions' using errcode = '22023';
  end if;

  update public.users as u
     set role = p_role
   where u.id = p_user_id
     and u.barbershop_id = v_shop;

  insert into public.barbershop_member_permissions (
    user_id, barbershop_id, permissions, updated_at
  )
  values (p_user_id, v_shop, v_permissions, now())
  on conflict (user_id) do update
    set barbershop_id = excluded.barbershop_id,
        permissions = excluded.permissions,
        updated_at = excluded.updated_at;

  perform public.sync_barber_professional(p_user_id, v_shop, p_role);
end;
$$;

create or replace function public.remove_barbershop_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_shop uuid;
  v_actor_role text;
  v_target_role text;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select u.barbershop_id, lower(coalesce(u.role, ''))
    into v_shop, v_actor_role
    from public.users as u
   where u.id = v_actor;

  if v_shop is null or v_actor_role <> 'owner' then
    raise exception 'team_permission_required' using errcode = '42501';
  end if;

  select lower(coalesce(u.role, ''))
    into v_target_role
    from public.users as u
   where u.id = p_user_id
     and u.barbershop_id = v_shop
   for update;

  if v_target_role is null then
    raise exception 'member_not_found' using errcode = '22023';
  end if;
  if v_target_role = 'owner' then
    raise exception 'owner_role_is_immutable' using errcode = '42501';
  end if;
  if v_target_role = 'client' then
    raise exception 'clients_are_not_team_members' using errcode = '22023';
  end if;

  update public.professionals as p
     set active = false
   where p.barbershop_id = v_shop
     and p.user_id = p_user_id;

  update public.users as u
     set barbershop_id = null,
         role = 'client'
   where u.id = p_user_id
     and u.barbershop_id = v_shop;

  -- Scope permission cleanup to the same tenant; never delete another shop's
  -- membership permissions if a foreign user ID is supplied.
  delete from public.barbershop_member_permissions as permissions
   where permissions.user_id = p_user_id
     and permissions.barbershop_id = v_shop;
end;
$$;

revoke all on function public.update_barbershop_member(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_barbershop_member(uuid, text, jsonb) to authenticated, service_role;

revoke all on function public.remove_barbershop_member(uuid) from public, anon, authenticated;
grant execute on function public.remove_barbershop_member(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

begin;

-- Keep directory privacy as a Pro/Enterprise permission while resolving every
-- administrative override through the same canonical resolver as paid access.
create or replace function public.set_barbershop_directory_visibility(
  p_actor_user_id uuid,
  p_barbershop_id uuid,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_barbershop_id uuid;
  v_role text;
  v_plan text := 'free';
begin
  if auth.uid() is null
     or p_actor_user_id is null
     or auth.uid() <> p_actor_user_id then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select u.barbershop_id, u.role
    into v_user_barbershop_id, v_role
  from public.users u
  where u.id = auth.uid();

  if v_user_barbershop_id is null
     or v_user_barbershop_id <> p_barbershop_id then
    raise exception using errcode = '42501', message = 'BARBERSHOP_ACCESS_DENIED';
  end if;

  if coalesce(lower(v_role), '') not in ('admin', 'owner') then
    raise exception using errcode = '42501', message = 'DIRECTORY_VISIBILITY_DENIED';
  end if;

  v_plan := coalesce(
    public.get_effective_billing_plan_for_barbershop(p_barbershop_id),
    'free'
  );

  -- Showing a barbershop is available on every plan. Hiding it is Pro+.
  if not coalesce(p_visible, true)
     and v_plan not in ('pro', 'enterprise') then
    raise exception using errcode = '42501', message = 'DIRECTORY_VISIBILITY_PRO_REQUIRED';
  end if;

  update public.barbershops
  set is_public_in_directory = coalesce(p_visible, true),
      updated_at = now()
  where id = p_barbershop_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'BARBERSHOP_NOT_FOUND';
  end if;

  return true;
end;
$$;

-- Reuse the same effective-plan resolver when paid access changes. This also
-- covers administrative assignments, rather than looking only at subscriptions.
create or replace function public.restore_directory_visibility_without_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_barbershop_id uuid;
  v_effective_plan text;
begin
  if tg_table_name = 'barbershop_plan_assignments' then
    if tg_op = 'DELETE' then
      v_barbershop_id := old.barbershop_id;
    else
      v_barbershop_id := new.barbershop_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_user_id := old.user_id;
    else
      v_user_id := new.user_id;
    end if;

    select u.barbershop_id
      into v_barbershop_id
    from public.users u
    where u.id = v_user_id;
  end if;

  if v_barbershop_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_effective_plan := coalesce(
    public.get_effective_billing_plan_for_barbershop(v_barbershop_id),
    'free'
  );

  if v_effective_plan not in ('pro', 'enterprise') then
    update public.barbershops
    set is_public_in_directory = true,
        updated_at = now()
    where id = v_barbershop_id
      and is_public_in_directory = false;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.set_barbershop_directory_visibility(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_barbershop_directory_visibility(uuid, uuid, boolean)
  to authenticated, service_role;

revoke all on function public.restore_directory_visibility_without_pro()
  from public, anon, authenticated;

drop trigger if exists restore_directory_visibility_without_pro
  on public.subscriptions;
drop trigger if exists restore_directory_visibility_after_plan_update
  on public.subscriptions;

create trigger restore_directory_visibility_without_pro
after insert or delete
on public.subscriptions
for each row
execute function public.restore_directory_visibility_without_pro();

create trigger restore_directory_visibility_after_plan_update
after update of status, plan, plan_override
on public.subscriptions
for each row
execute function public.restore_directory_visibility_without_pro();

drop trigger if exists restore_directory_visibility_after_plan_assignment
  on public.barbershop_plan_assignments;

create trigger restore_directory_visibility_after_plan_assignment
after insert or update or delete
on public.barbershop_plan_assignments
for each row
execute function public.restore_directory_visibility_without_pro();

comment on column public.barbershops.is_public_in_directory is
  'Controls public discovery in the barbershop directory. When false, the direct public URL and booking page remain available.';

notify pgrst, 'reload schema';

commit;

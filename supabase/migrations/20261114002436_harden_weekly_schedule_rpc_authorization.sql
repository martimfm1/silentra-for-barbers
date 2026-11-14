begin;

-- Schedule changes must be restricted to barbershop administrators.
-- get_my_barbershop_id() alone is not sufficient because customer profiles
-- also carry a barbershop_id.
create or replace function public.set_barbershop_weekly_schedule(
  p_barbershop_id uuid,
  p_weekly_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.barbershop_id = p_barbershop_id
        and u.role in ('owner', 'admin')
    )
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if not public.is_valid_weekly_schedule(p_weekly_schedule) then
    raise exception using errcode = '22023', message = 'INVALID_WEEKLY_SCHEDULE';
  end if;

  update public.barbershops
  set weekly_schedule = p_weekly_schedule,
      updated_at = now()
  where id = p_barbershop_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'BARBERSHOP_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.set_barbershop_weekly_schedule(uuid, jsonb)
  from public, anon;
grant execute on function public.set_barbershop_weekly_schedule(uuid, jsonb)
  to authenticated;

create or replace function public.set_professional_weekly_schedule(
  p_professional_id uuid,
  p_weekly_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barbershop_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select p.barbershop_id
  into v_barbershop_id
  from public.professionals p
  where p.id = p_professional_id;

  if v_barbershop_id is null
    or not exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.barbershop_id = v_barbershop_id
        and u.role in ('owner', 'admin')
    )
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_weekly_schedule is not null
    and not public.is_valid_weekly_schedule(p_weekly_schedule)
  then
    raise exception using errcode = '22023', message = 'INVALID_WEEKLY_SCHEDULE';
  end if;

  update public.professionals
  set weekly_schedule = p_weekly_schedule
  where id = p_professional_id
    and barbershop_id = v_barbershop_id;
end;
$$;

revoke all on function public.set_professional_weekly_schedule(uuid, jsonb)
  from public, anon;
grant execute on function public.set_professional_weekly_schedule(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;

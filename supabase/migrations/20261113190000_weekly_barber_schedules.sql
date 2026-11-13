-- Weekly opening hours with optional per-professional overrides.
alter table public.barbershops
  add column if not exists weekly_schedule jsonb;

alter table public.professionals
  add column if not exists weekly_schedule jsonb;

-- Preserve each shop's current weekly configuration when introducing the new model.
do $$
declare
  v_shop record;
  v_schedule jsonb;
  v_day_key text;
  v_day_index integer;
  v_day_name text;
  v_tokens text[];
  v_day_off boolean;
  v_open text;
  v_close text;
  v_lunch_start text;
  v_lunch_end text;
  v_work jsonb;
  v_breaks jsonb;
begin
  for v_shop in
    select id, opening_time, closing_time, lunch_start, lunch_end, closed_days
    from public.barbershops
    where weekly_schedule is null
  loop
    v_schedule := '{}'::jsonb;
    v_tokens := regexp_split_to_array(
      lower(coalesce(v_shop.closed_days, '')),
      '\s*,\s*'
    );
    v_open := coalesce(to_char(v_shop.opening_time, 'HH24:MI'), '09:00');
    v_close := coalesce(to_char(v_shop.closing_time, 'HH24:MI'), '19:00');
    v_lunch_start := to_char(v_shop.lunch_start, 'HH24:MI');
    v_lunch_end := to_char(v_shop.lunch_end, 'HH24:MI');

    for v_day_index in 0..6 loop
      case v_day_index
        when 0 then
          v_day_key := 'sunday';
          v_day_name := 'domingo';
        when 1 then
          v_day_key := 'monday';
          v_day_name := 'segunda-feira';
        when 2 then
          v_day_key := 'tuesday';
          v_day_name := 'terça-feira';
        when 3 then
          v_day_key := 'wednesday';
          v_day_name := 'quarta-feira';
        when 4 then
          v_day_key := 'thursday';
          v_day_name := 'quinta-feira';
        when 5 then
          v_day_key := 'friday';
          v_day_name := 'sexta-feira';
        else
          v_day_key := 'saturday';
          v_day_name := 'sábado';
      end case;

      v_day_off :=
        v_day_key = any(v_tokens)
        or v_day_index::text = any(v_tokens)
        or v_day_name = any(v_tokens)
        or replace(v_day_name, '-feira', '') = any(v_tokens)
        or (v_day_key = 'tuesday' and 'terca-feira' = any(v_tokens))
        or (v_day_key = 'saturday' and 'sabado' = any(v_tokens))
        or (v_day_key = 'sunday' and 'domingo' = any(v_tokens));

      v_work := '[]'::jsonb;
      v_breaks := '[]'::jsonb;

      if not v_day_off and v_open < v_close then
        v_work := jsonb_build_array(
          jsonb_build_object('start', v_open, 'end', v_close)
        );
        if v_lunch_start is not null
          and v_lunch_end is not null
          and v_lunch_start < v_lunch_end
          and v_lunch_start >= v_open
          and v_lunch_end <= v_close
        then
          v_breaks := jsonb_build_array(
            jsonb_build_object('start', v_lunch_start, 'end', v_lunch_end)
          );
        end if;
      end if;

      v_schedule := v_schedule || jsonb_build_object(
        v_day_key,
        jsonb_build_object(
          'day_off', v_day_off,
          'work_intervals', v_work,
          'break_intervals', v_breaks
        )
      );
    end loop;

    update public.barbershops
    set weekly_schedule = v_schedule
    where id = v_shop.id;
  end loop;
end;
$$;

create or replace function public.is_valid_weekly_schedule(
  p_weekly_schedule jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_day_key text;
  v_day jsonb;
  v_item jsonb;
  v_work_item jsonb;
  v_start text;
  v_end text;
  v_previous_end text;
  v_inside_work_period boolean;
begin
  if jsonb_typeof(p_weekly_schedule) is distinct from 'object' then
    return false;
  end if;

  foreach v_day_key in array array[
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday'
  ] loop
    v_day := p_weekly_schedule -> v_day_key;
    if jsonb_typeof(v_day) is distinct from 'object'
      or jsonb_typeof(v_day -> 'day_off') is distinct from 'boolean'
      or jsonb_typeof(v_day -> 'work_intervals') is distinct from 'array'
      or jsonb_typeof(v_day -> 'break_intervals') is distinct from 'array'
    then
      return false;
    end if;

    if (v_day ->> 'day_off')::boolean then
      continue;
    end if;

    if jsonb_array_length(v_day -> 'work_intervals') = 0 then
      return false;
    end if;

    v_previous_end := null;
    for v_item in
      select value from jsonb_array_elements(v_day -> 'work_intervals')
    loop
      if jsonb_typeof(v_item) is distinct from 'object' then
        return false;
      end if;
      v_start := v_item ->> 'start';
      v_end := v_item ->> 'end';
      if v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_start >= v_end
        or (v_previous_end is not null and v_start < v_previous_end)
      then
        return false;
      end if;
      v_previous_end := v_end;
    end loop;

    v_previous_end := null;
    for v_item in
      select value from jsonb_array_elements(v_day -> 'break_intervals')
    loop
      if jsonb_typeof(v_item) is distinct from 'object' then
        return false;
      end if;
      v_start := v_item ->> 'start';
      v_end := v_item ->> 'end';
      if v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_start >= v_end
        or (v_previous_end is not null and v_start < v_previous_end)
      then
        return false;
      end if;

      v_inside_work_period := false;
      for v_work_item in
        select value from jsonb_array_elements(v_day -> 'work_intervals')
      loop
        if (v_work_item ->> 'start') <= v_start
          and (v_work_item ->> 'end') >= v_end
        then
          v_inside_work_period := true;
          exit;
        end if;
      end loop;
      if not v_inside_work_period then
        return false;
      end if;
      v_previous_end := v_end;
    end loop;
  end loop;

  return true;
end;
$$;

revoke all on function public.is_valid_weekly_schedule(jsonb)
  from public, anon, authenticated;

create or replace function public.set_barbershop_weekly_schedule(
  p_barbershop_id uuid,
  p_weekly_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or public.get_my_barbershop_id() is distinct from p_barbershop_id
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
set search_path = public
as $$
declare
  v_barbershop_id uuid;
begin
  select barbershop_id
  into v_barbershop_id
  from public.professionals
  where id = p_professional_id;

  if v_barbershop_id is null
    or auth.uid() is null
    or public.get_my_barbershop_id() is distinct from v_barbershop_id
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

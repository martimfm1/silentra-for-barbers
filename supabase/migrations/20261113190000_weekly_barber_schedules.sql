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

  if jsonb_typeof(p_weekly_schedule) <> 'object'
    or not (
      p_weekly_schedule ? 'monday'
      and p_weekly_schedule ? 'tuesday'
      and p_weekly_schedule ? 'wednesday'
      and p_weekly_schedule ? 'thursday'
      and p_weekly_schedule ? 'friday'
      and p_weekly_schedule ? 'saturday'
      and p_weekly_schedule ? 'sunday'
    )
  then
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

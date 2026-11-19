begin;

-- Persist the complete weekly calendar at the same transaction boundary as
-- the first service and professional. Legacy opening/closing times are kept
-- as broad compatibility bounds derived from the real weekly intervals.
create or replace function public.create_barbershop_onboarding_with_weekly_schedule(
  p_name text,
  p_address text,
  p_city text,
  p_price numeric,
  p_tags text[],
  p_lat numeric,
  p_lng numeric,
  p_service_name text,
  p_service_duration integer,
  p_weekly_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_opening_time time;
  v_closing_time time;
  v_onboarding_result jsonb;
  v_barbershop_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if p_weekly_schedule is null
    or not public.is_valid_weekly_schedule(p_weekly_schedule)
  then
    raise exception using errcode = '22023', message = 'INVALID_WEEKLY_SCHEDULE';
  end if;

  select
    min((interval_item ->> 'start')::time),
    max((interval_item ->> 'end')::time)
  into v_opening_time, v_closing_time
  from jsonb_each(p_weekly_schedule) as day_item(day_key, day_value)
  cross join lateral jsonb_array_elements(day_item.day_value -> 'work_intervals') as interval_item
  where day_item.day_value ->> 'day_off' = 'false';

  if v_opening_time is null
    or v_closing_time is null
    or v_opening_time >= v_closing_time
  then
    raise exception using errcode = '22023', message = 'AT_LEAST_ONE_WORKING_INTERVAL_REQUIRED';
  end if;

  v_onboarding_result := public.create_barbershop_onboarding_with_defaults(
    p_name,
    p_address,
    p_city,
    v_opening_time,
    v_closing_time,
    p_price,
    coalesce(p_tags, '{}'::text[]),
    p_lat,
    p_lng,
    p_service_name,
    p_service_duration
  );

  v_barbershop_id := (v_onboarding_result ->> 'barbershop_id')::uuid;
  if v_barbershop_id is null then
    raise exception using errcode = 'P0002', message = 'ONBOARDING_BARBERSHOP_NOT_CREATED';
  end if;

  update public.barbershops
  set weekly_schedule = p_weekly_schedule,
      updated_at = now()
  where id = v_barbershop_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'ONBOARDING_SCHEDULE_NOT_PERSISTED';
  end if;

  return v_onboarding_result || jsonb_build_object(
    'weekly_schedule_persisted', true
  );
end;
$function$;

revoke all on function public.create_barbershop_onboarding_with_weekly_schedule(
  text, text, text, numeric, text[], numeric, numeric, text, integer, jsonb
) from public, anon;

grant execute on function public.create_barbershop_onboarding_with_weekly_schedule(
  text, text, text, numeric, text[], numeric, numeric, text, integer, jsonb
) to authenticated;

comment on function public.create_barbershop_onboarding_with_weekly_schedule(
  text, text, text, numeric, text[], numeric, numeric, text, integer, jsonb
) is 'Creates a barbershop with its first service and professional and persists the complete weekly opening schedule atomically.';

notify pgrst, 'reload schema';
commit;
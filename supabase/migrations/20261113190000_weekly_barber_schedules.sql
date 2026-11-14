begin;

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
    v_open := coalesce(left(v_shop.opening_time::text, 5), '09:00');
    v_close := coalesce(left(v_shop.closing_time::text, 5), '19:00');
    v_lunch_start := left(v_shop.lunch_start::text, 5);
    v_lunch_end := left(v_shop.lunch_end::text, 5);

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
      if v_start is null
        or v_end is null
        or v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]
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

-- Ensure the atomic booking RPC respects the chosen barber's weekly schedule.

-- Reconcile the public booking RPC after the manual-booking auto-confirmation
-- migration replaced it with an older implementation that discarded MB WAY
-- prepayment metadata and treated "prepayment_pending" as a confirmed booking.
create or replace function public.create_booking_atomic(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date_hour timestamptz,
  p_duration_minutes integer,
  p_manual_name text,
  p_manual_phone text,
  p_manual_email text,
  p_manual_birth_date date,
  p_status text default 'scheduled'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_status public.appointment_status := case
    when lower(trim(coalesce(p_status, 'scheduled'))) in ('pending', 'prepayment_pending')
      then 'pending'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
  v_email text := lower(nullif(trim(coalesce(p_manual_email, '')), ''));
  v_phone_digits text := regexp_replace(coalesce(p_manual_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_weekday integer;
  v_day_key text;
  v_weekly_schedule jsonb;
  v_day_schedule jsonb;
  v_closed boolean := false;
  v_closed_days text;
  v_open_time time;
  v_close_time time;
  v_lunch_start time;
  v_lunch_end time;
  v_requested_start integer;
  v_requested_end integer;
  v_within_work_period boolean := false;
  v_overlaps_break boolean := false;
  v_auto_confirm boolean := false;
  v_auto_confirm_manual boolean := true;
  v_is_prepayment boolean :=
    lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
  v_payment_amount numeric(12,2);
begin
  if p_barbershop_id is null or p_service_id is null or p_date_hour is null then
    raise exception using errcode = '22023', message = 'BOOKING_REQUIRED_FIELDS';
  end if;

  v_phone := case
    when left(v_phone_digits, 2) = '00' then substring(v_phone_digits from 3)
    when left(v_phone_digits, 3) = '351' and length(v_phone_digits) = 12 then substring(v_phone_digits from 4)
    else v_phone_digits
  end;

  select
    coalesce(p.weekly_schedule, b.weekly_schedule),
    b.opening_time,
    b.closing_time,
    b.lunch_start,
    b.lunch_end,
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_weekly_schedule,
    v_open_time,
    v_close_time,
    v_lunch_start,
    v_lunch_end,
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  left join public.professionals p
    on p.id = p_professional_id
    and p.barbershop_id = b.id
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_day_key := case v_weekday
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;
  v_day_schedule := v_weekly_schedule -> v_day_key;

  -- New shops created after this migration may not have been backfilled yet.
  -- For those, retain the current legacy settings as a safe fallback.
  if v_day_schedule is null then
    select exists (
      select 1
      from unnest(string_to_array(lower(coalesce(v_closed_days, '')), ',')) as d(value)
      where trim(d.value) = any (
        case v_weekday
          when 0 then array['0','sunday','domingo','domingo-feira']
          when 1 then array['1','monday','segunda','segunda-feira']
          when 2 then array['2','tuesday','terca','terça','terca-feira','terça-feira']
          when 3 then array['3','wednesday','quarta','quarta-feira']
          when 4 then array['4','thursday','quinta','quinta-feira']
          when 5 then array['5','friday','sexta','sexta-feira']
          when 6 then array['6','saturday','sabado','sábado','sábado-feira']
        end
      )
    ) into v_closed;

    if v_closed then
      v_day_schedule := jsonb_build_object(
        'day_off', true,
        'work_intervals', '[]'::jsonb,
        'break_intervals', '[]'::jsonb
      );
    else
      v_open_time := coalesce(v_open_time, time '09:00');
      v_close_time := coalesce(v_close_time, time '19:00');
      v_day_schedule := jsonb_build_object(
        'day_off', false,
        'work_intervals',
          case when v_open_time < v_close_time then
            jsonb_build_array(jsonb_build_object(
              'start', left(v_open_time::text, 5),
              'end', left(v_close_time::text, 5)
            ))
          else '[]'::jsonb end,
        'break_intervals',
          case
            when v_lunch_start is not null
              and v_lunch_end is not null
              and v_lunch_start < v_lunch_end
              and v_lunch_start >= v_open_time
              and v_lunch_end <= v_close_time
            then jsonb_build_array(jsonb_build_object(
              'start', left(v_lunch_start::text, 5),
              'end', left(v_lunch_end::text, 5)
            ))
            else '[]'::jsonb
          end
      );
    end if;
  end if;

  if coalesce((v_day_schedule ->> 'day_off')::boolean, false) then
    raise exception using errcode = 'P0001',
      message = case when p_professional_id is null
        then 'BARBERSHOP_CLOSED_DAY'
        else 'PROFESSIONAL_DAY_OFF'
      end;
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'work_intervals', '[]'::jsonb)
    ) as work_period(value)
    where
      v_requested_start >=
        split_part(work_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'start', ':', 2)::integer
      and v_requested_end <=
        split_part(work_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'end', ':', 2)::integer
  ) into v_within_work_period;

  if not v_within_work_period then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OUTSIDE_WORKING_HOURS';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'break_intervals', '[]'::jsonb)
    ) as break_period(value)
    where
      v_requested_start <
        split_part(break_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'end', ':', 2)::integer
      and v_requested_end >
        split_part(break_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'start', ':', 2)::integer
  ) into v_overlaps_break;

  if v_overlaps_break then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OVERLAPS_BREAK';
  end if;

  -- Internal manual bookings retain their own confirmation setting.
  -- Public requests still respect auto-confirm, except MB WAY prepayments:
  -- those must always remain pending until the barber reviews the payment.
  if lower(trim(coalesce(p_status, 'scheduled'))) = 'manual' then
    v_status := case
      when v_auto_confirm_manual then 'scheduled'::public.appointment_status
      else 'pending'::public.appointment_status
    end;
  elsif v_auto_confirm and not v_is_prepayment then
    v_status := 'scheduled'::public.appointment_status;
  end if;

  select coalesce(s.price, 0)::numeric(12,2)
    into v_payment_amount
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  if v_is_prepayment and coalesce(v_payment_amount, 0) <= 0 then
    raise exception using errcode = '22023', message = 'BOOKING_PREPAYMENT_AMOUNT_INVALID';
  end if;

  if p_professional_id is not null and not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.barbershop_id = p_barbershop_id
      and p.active = true
  ) then
    raise exception using errcode = '22023', message = 'BOOKING_PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An expired MB WAY hold no longer owns the slot, even if the expiry
      -- worker has not yet run and changed its status to cancelled.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
      )
      and a.date_hour < p_date_hour + make_interval(mins => v_duration)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
      ) > p_date_hour
      and (
        p_professional_id is null
        or a.professional_id is null
        or a.professional_id = p_professional_id
      )
  ) into v_existing;

  if v_existing then
    raise exception using errcode = '23P01', message = 'BOOKING_CONFLICT';
  end if;

  if v_email is not null and length(v_phone) >= 7 then
    select u.id
      into v_client_id
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and lower(trim(coalesce(u.email, ''))) = v_email
      and (
        case
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 2) = '00'
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 3)
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 3) = '351'
               and length(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')) = 12
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 4)
          else regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')
        end
      ) = v_phone
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.appointments (
    barbershop_id,
    client_id,
    service_id,
    professional_id,
    date_hour,
    status,
    manual_name,
    manual_phone,
    manual_email,
    manual_birth_date,
    duration_minutes,
    payment_method,
    payment_status,
    payment_amount,
    payment_expires_at
  )
  values (
    p_barbershop_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_date_hour,
    v_status,
    nullif(left(trim(coalesce(p_manual_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_manual_phone, '')), 40), ''),
    v_email,
    p_manual_birth_date,
    v_duration,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$;

revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) to service_role;

comment on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) is
  'Atomic tenant-scoped public booking creation with MB WAY prepayment holds, expiry-aware conflict checks, client matching and separate manual/online auto-confirmation settings.';

notify pgrst, 'reload schema';

commit;

        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]
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

-- Ensure the atomic booking RPC respects the chosen barber's weekly schedule.

-- Reconcile the public booking RPC after the manual-booking auto-confirmation
-- migration replaced it with an older implementation that discarded MB WAY
-- prepayment metadata and treated "prepayment_pending" as a confirmed booking.
create or replace function public.create_booking_atomic(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date_hour timestamptz,
  p_duration_minutes integer,
  p_manual_name text,
  p_manual_phone text,
  p_manual_email text,
  p_manual_birth_date date,
  p_status text default 'scheduled'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_status public.appointment_status := case
    when lower(trim(coalesce(p_status, 'scheduled'))) in ('pending', 'prepayment_pending')
      then 'pending'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
  v_email text := lower(nullif(trim(coalesce(p_manual_email, '')), ''));
  v_phone_digits text := regexp_replace(coalesce(p_manual_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_weekday integer;
  v_day_key text;
  v_weekly_schedule jsonb;
  v_day_schedule jsonb;
  v_closed boolean := false;
  v_closed_days text;
  v_open_time time;
  v_close_time time;
  v_lunch_start time;
  v_lunch_end time;
  v_requested_start integer;
  v_requested_end integer;
  v_within_work_period boolean := false;
  v_overlaps_break boolean := false;
  v_auto_confirm boolean := false;
  v_auto_confirm_manual boolean := true;
  v_is_prepayment boolean :=
    lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
  v_payment_amount numeric(12,2);
begin
  if p_barbershop_id is null or p_service_id is null or p_date_hour is null then
    raise exception using errcode = '22023', message = 'BOOKING_REQUIRED_FIELDS';
  end if;

  v_phone := case
    when left(v_phone_digits, 2) = '00' then substring(v_phone_digits from 3)
    when left(v_phone_digits, 3) = '351' and length(v_phone_digits) = 12 then substring(v_phone_digits from 4)
    else v_phone_digits
  end;

  select
    coalesce(p.weekly_schedule, b.weekly_schedule),
    b.opening_time,
    b.closing_time,
    b.lunch_start,
    b.lunch_end,
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_weekly_schedule,
    v_open_time,
    v_close_time,
    v_lunch_start,
    v_lunch_end,
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  left join public.professionals p
    on p.id = p_professional_id
    and p.barbershop_id = b.id
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_day_key := case v_weekday
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;
  v_day_schedule := v_weekly_schedule -> v_day_key;

  -- New shops created after this migration may not have been backfilled yet.
  -- For those, retain the current legacy settings as a safe fallback.
  if v_day_schedule is null then
    select exists (
      select 1
      from unnest(string_to_array(lower(coalesce(v_closed_days, '')), ',')) as d(value)
      where trim(d.value) = any (
        case v_weekday
          when 0 then array['0','sunday','domingo','domingo-feira']
          when 1 then array['1','monday','segunda','segunda-feira']
          when 2 then array['2','tuesday','terca','terça','terca-feira','terça-feira']
          when 3 then array['3','wednesday','quarta','quarta-feira']
          when 4 then array['4','thursday','quinta','quinta-feira']
          when 5 then array['5','friday','sexta','sexta-feira']
          when 6 then array['6','saturday','sabado','sábado','sábado-feira']
        end
      )
    ) into v_closed;

    if v_closed then
      v_day_schedule := jsonb_build_object(
        'day_off', true,
        'work_intervals', '[]'::jsonb,
        'break_intervals', '[]'::jsonb
      );
    else
      v_open_time := coalesce(v_open_time, time '09:00');
      v_close_time := coalesce(v_close_time, time '19:00');
      v_day_schedule := jsonb_build_object(
        'day_off', false,
        'work_intervals',
          case when v_open_time < v_close_time then
            jsonb_build_array(jsonb_build_object(
              'start', left(v_open_time::text, 5),
              'end', left(v_close_time::text, 5)
            ))
          else '[]'::jsonb end,
        'break_intervals',
          case
            when v_lunch_start is not null
              and v_lunch_end is not null
              and v_lunch_start < v_lunch_end
              and v_lunch_start >= v_open_time
              and v_lunch_end <= v_close_time
            then jsonb_build_array(jsonb_build_object(
              'start', left(v_lunch_start::text, 5),
              'end', left(v_lunch_end::text, 5)
            ))
            else '[]'::jsonb
          end
      );
    end if;
  end if;

  if coalesce((v_day_schedule ->> 'day_off')::boolean, false) then
    raise exception using errcode = 'P0001',
      message = case when p_professional_id is null
        then 'BARBERSHOP_CLOSED_DAY'
        else 'PROFESSIONAL_DAY_OFF'
      end;
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'work_intervals', '[]'::jsonb)
    ) as work_period(value)
    where
      v_requested_start >=
        split_part(work_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'start', ':', 2)::integer
      and v_requested_end <=
        split_part(work_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'end', ':', 2)::integer
  ) into v_within_work_period;

  if not v_within_work_period then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OUTSIDE_WORKING_HOURS';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'break_intervals', '[]'::jsonb)
    ) as break_period(value)
    where
      v_requested_start <
        split_part(break_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'end', ':', 2)::integer
      and v_requested_end >
        split_part(break_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'start', ':', 2)::integer
  ) into v_overlaps_break;

  if v_overlaps_break then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OVERLAPS_BREAK';
  end if;

  -- Internal manual bookings retain their own confirmation setting.
  -- Public requests still respect auto-confirm, except MB WAY prepayments:
  -- those must always remain pending until the barber reviews the payment.
  if lower(trim(coalesce(p_status, 'scheduled'))) = 'manual' then
    v_status := case
      when v_auto_confirm_manual then 'scheduled'::public.appointment_status
      else 'pending'::public.appointment_status
    end;
  elsif v_auto_confirm and not v_is_prepayment then
    v_status := 'scheduled'::public.appointment_status;
  end if;

  select coalesce(s.price, 0)::numeric(12,2)
    into v_payment_amount
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  if v_is_prepayment and coalesce(v_payment_amount, 0) <= 0 then
    raise exception using errcode = '22023', message = 'BOOKING_PREPAYMENT_AMOUNT_INVALID';
  end if;

  if p_professional_id is not null and not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.barbershop_id = p_barbershop_id
      and p.active = true
  ) then
    raise exception using errcode = '22023', message = 'BOOKING_PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An expired MB WAY hold no longer owns the slot, even if the expiry
      -- worker has not yet run and changed its status to cancelled.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
      )
      and a.date_hour < p_date_hour + make_interval(mins => v_duration)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
      ) > p_date_hour
      and (
        p_professional_id is null
        or a.professional_id is null
        or a.professional_id = p_professional_id
      )
  ) into v_existing;

  if v_existing then
    raise exception using errcode = '23P01', message = 'BOOKING_CONFLICT';
  end if;

  if v_email is not null and length(v_phone) >= 7 then
    select u.id
      into v_client_id
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and lower(trim(coalesce(u.email, ''))) = v_email
      and (
        case
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 2) = '00'
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 3)
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 3) = '351'
               and length(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')) = 12
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 4)
          else regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')
        end
      ) = v_phone
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.appointments (
    barbershop_id,
    client_id,
    service_id,
    professional_id,
    date_hour,
    status,
    manual_name,
    manual_phone,
    manual_email,
    manual_birth_date,
    duration_minutes,
    payment_method,
    payment_status,
    payment_amount,
    payment_expires_at
  )
  values (
    p_barbershop_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_date_hour,
    v_status,
    nullif(left(trim(coalesce(p_manual_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_manual_phone, '')), 40), ''),
    v_email,
    p_manual_birth_date,
    v_duration,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$;

revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) to service_role;

comment on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) is
  'Atomic tenant-scoped public booking creation with MB WAY prepayment holds, expiry-aware conflict checks, client matching and separate manual/online auto-confirmation settings.';

notify pgrst, 'reload schema';

commit;

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
      if v_start is null
        or v_end is null
        or v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]
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

-- Ensure the atomic booking RPC respects the chosen barber's weekly schedule.

-- Reconcile the public booking RPC after the manual-booking auto-confirmation
-- migration replaced it with an older implementation that discarded MB WAY
-- prepayment metadata and treated "prepayment_pending" as a confirmed booking.
create or replace function public.create_booking_atomic(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date_hour timestamptz,
  p_duration_minutes integer,
  p_manual_name text,
  p_manual_phone text,
  p_manual_email text,
  p_manual_birth_date date,
  p_status text default 'scheduled'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_status public.appointment_status := case
    when lower(trim(coalesce(p_status, 'scheduled'))) in ('pending', 'prepayment_pending')
      then 'pending'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
  v_email text := lower(nullif(trim(coalesce(p_manual_email, '')), ''));
  v_phone_digits text := regexp_replace(coalesce(p_manual_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_weekday integer;
  v_day_key text;
  v_weekly_schedule jsonb;
  v_day_schedule jsonb;
  v_closed boolean := false;
  v_closed_days text;
  v_open_time time;
  v_close_time time;
  v_lunch_start time;
  v_lunch_end time;
  v_requested_start integer;
  v_requested_end integer;
  v_within_work_period boolean := false;
  v_overlaps_break boolean := false;
  v_auto_confirm boolean := false;
  v_auto_confirm_manual boolean := true;
  v_is_prepayment boolean :=
    lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
  v_payment_amount numeric(12,2);
begin
  if p_barbershop_id is null or p_service_id is null or p_date_hour is null then
    raise exception using errcode = '22023', message = 'BOOKING_REQUIRED_FIELDS';
  end if;

  v_phone := case
    when left(v_phone_digits, 2) = '00' then substring(v_phone_digits from 3)
    when left(v_phone_digits, 3) = '351' and length(v_phone_digits) = 12 then substring(v_phone_digits from 4)
    else v_phone_digits
  end;

  select
    coalesce(p.weekly_schedule, b.weekly_schedule),
    b.opening_time,
    b.closing_time,
    b.lunch_start,
    b.lunch_end,
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_weekly_schedule,
    v_open_time,
    v_close_time,
    v_lunch_start,
    v_lunch_end,
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  left join public.professionals p
    on p.id = p_professional_id
    and p.barbershop_id = b.id
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_day_key := case v_weekday
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;
  v_day_schedule := v_weekly_schedule -> v_day_key;

  -- New shops created after this migration may not have been backfilled yet.
  -- For those, retain the current legacy settings as a safe fallback.
  if v_day_schedule is null then
    select exists (
      select 1
      from unnest(string_to_array(lower(coalesce(v_closed_days, '')), ',')) as d(value)
      where trim(d.value) = any (
        case v_weekday
          when 0 then array['0','sunday','domingo','domingo-feira']
          when 1 then array['1','monday','segunda','segunda-feira']
          when 2 then array['2','tuesday','terca','terça','terca-feira','terça-feira']
          when 3 then array['3','wednesday','quarta','quarta-feira']
          when 4 then array['4','thursday','quinta','quinta-feira']
          when 5 then array['5','friday','sexta','sexta-feira']
          when 6 then array['6','saturday','sabado','sábado','sábado-feira']
        end
      )
    ) into v_closed;

    if v_closed then
      v_day_schedule := jsonb_build_object(
        'day_off', true,
        'work_intervals', '[]'::jsonb,
        'break_intervals', '[]'::jsonb
      );
    else
      v_open_time := coalesce(v_open_time, time '09:00');
      v_close_time := coalesce(v_close_time, time '19:00');
      v_day_schedule := jsonb_build_object(
        'day_off', false,
        'work_intervals',
          case when v_open_time < v_close_time then
            jsonb_build_array(jsonb_build_object(
              'start', left(v_open_time::text, 5),
              'end', left(v_close_time::text, 5)
            ))
          else '[]'::jsonb end,
        'break_intervals',
          case
            when v_lunch_start is not null
              and v_lunch_end is not null
              and v_lunch_start < v_lunch_end
              and v_lunch_start >= v_open_time
              and v_lunch_end <= v_close_time
            then jsonb_build_array(jsonb_build_object(
              'start', left(v_lunch_start::text, 5),
              'end', left(v_lunch_end::text, 5)
            ))
            else '[]'::jsonb
          end
      );
    end if;
  end if;

  if coalesce((v_day_schedule ->> 'day_off')::boolean, false) then
    raise exception using errcode = 'P0001',
      message = case when p_professional_id is null
        then 'BARBERSHOP_CLOSED_DAY'
        else 'PROFESSIONAL_DAY_OFF'
      end;
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'work_intervals', '[]'::jsonb)
    ) as work_period(value)
    where
      v_requested_start >=
        split_part(work_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'start', ':', 2)::integer
      and v_requested_end <=
        split_part(work_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'end', ':', 2)::integer
  ) into v_within_work_period;

  if not v_within_work_period then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OUTSIDE_WORKING_HOURS';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'break_intervals', '[]'::jsonb)
    ) as break_period(value)
    where
      v_requested_start <
        split_part(break_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'end', ':', 2)::integer
      and v_requested_end >
        split_part(break_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'start', ':', 2)::integer
  ) into v_overlaps_break;

  if v_overlaps_break then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OVERLAPS_BREAK';
  end if;

  -- Internal manual bookings retain their own confirmation setting.
  -- Public requests still respect auto-confirm, except MB WAY prepayments:
  -- those must always remain pending until the barber reviews the payment.
  if lower(trim(coalesce(p_status, 'scheduled'))) = 'manual' then
    v_status := case
      when v_auto_confirm_manual then 'scheduled'::public.appointment_status
      else 'pending'::public.appointment_status
    end;
  elsif v_auto_confirm and not v_is_prepayment then
    v_status := 'scheduled'::public.appointment_status;
  end if;

  select coalesce(s.price, 0)::numeric(12,2)
    into v_payment_amount
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  if v_is_prepayment and coalesce(v_payment_amount, 0) <= 0 then
    raise exception using errcode = '22023', message = 'BOOKING_PREPAYMENT_AMOUNT_INVALID';
  end if;

  if p_professional_id is not null and not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.barbershop_id = p_barbershop_id
      and p.active = true
  ) then
    raise exception using errcode = '22023', message = 'BOOKING_PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An expired MB WAY hold no longer owns the slot, even if the expiry
      -- worker has not yet run and changed its status to cancelled.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
      )
      and a.date_hour < p_date_hour + make_interval(mins => v_duration)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
      ) > p_date_hour
      and (
        p_professional_id is null
        or a.professional_id is null
        or a.professional_id = p_professional_id
      )
  ) into v_existing;

  if v_existing then
    raise exception using errcode = '23P01', message = 'BOOKING_CONFLICT';
  end if;

  if v_email is not null and length(v_phone) >= 7 then
    select u.id
      into v_client_id
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and lower(trim(coalesce(u.email, ''))) = v_email
      and (
        case
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 2) = '00'
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 3)
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 3) = '351'
               and length(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')) = 12
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 4)
          else regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')
        end
      ) = v_phone
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.appointments (
    barbershop_id,
    client_id,
    service_id,
    professional_id,
    date_hour,
    status,
    manual_name,
    manual_phone,
    manual_email,
    manual_birth_date,
    duration_minutes,
    payment_method,
    payment_status,
    payment_amount,
    payment_expires_at
  )
  values (
    p_barbershop_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_date_hour,
    v_status,
    nullif(left(trim(coalesce(p_manual_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_manual_phone, '')), 40), ''),
    v_email,
    p_manual_birth_date,
    v_duration,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$;

revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) to service_role;

comment on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) is
  'Atomic tenant-scoped public booking creation with MB WAY prepayment holds, expiry-aware conflict checks, client matching and separate manual/online auto-confirmation settings.';

notify pgrst, 'reload schema';

commit;

        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]
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

-- Ensure the atomic booking RPC respects the chosen barber's weekly schedule.

-- Reconcile the public booking RPC after the manual-booking auto-confirmation
-- migration replaced it with an older implementation that discarded MB WAY
-- prepayment metadata and treated "prepayment_pending" as a confirmed booking.
create or replace function public.create_booking_atomic(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date_hour timestamptz,
  p_duration_minutes integer,
  p_manual_name text,
  p_manual_phone text,
  p_manual_email text,
  p_manual_birth_date date,
  p_status text default 'scheduled'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_status public.appointment_status := case
    when lower(trim(coalesce(p_status, 'scheduled'))) in ('pending', 'prepayment_pending')
      then 'pending'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
  v_email text := lower(nullif(trim(coalesce(p_manual_email, '')), ''));
  v_phone_digits text := regexp_replace(coalesce(p_manual_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_weekday integer;
  v_day_key text;
  v_weekly_schedule jsonb;
  v_day_schedule jsonb;
  v_closed boolean := false;
  v_closed_days text;
  v_open_time time;
  v_close_time time;
  v_lunch_start time;
  v_lunch_end time;
  v_requested_start integer;
  v_requested_end integer;
  v_within_work_period boolean := false;
  v_overlaps_break boolean := false;
  v_auto_confirm boolean := false;
  v_auto_confirm_manual boolean := true;
  v_is_prepayment boolean :=
    lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
  v_payment_amount numeric(12,2);
begin
  if p_barbershop_id is null or p_service_id is null or p_date_hour is null then
    raise exception using errcode = '22023', message = 'BOOKING_REQUIRED_FIELDS';
  end if;

  v_phone := case
    when left(v_phone_digits, 2) = '00' then substring(v_phone_digits from 3)
    when left(v_phone_digits, 3) = '351' and length(v_phone_digits) = 12 then substring(v_phone_digits from 4)
    else v_phone_digits
  end;

  select
    coalesce(p.weekly_schedule, b.weekly_schedule),
    b.opening_time,
    b.closing_time,
    b.lunch_start,
    b.lunch_end,
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_weekly_schedule,
    v_open_time,
    v_close_time,
    v_lunch_start,
    v_lunch_end,
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  left join public.professionals p
    on p.id = p_professional_id
    and p.barbershop_id = b.id
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_day_key := case v_weekday
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;
  v_day_schedule := v_weekly_schedule -> v_day_key;

  -- New shops created after this migration may not have been backfilled yet.
  -- For those, retain the current legacy settings as a safe fallback.
  if v_day_schedule is null then
    select exists (
      select 1
      from unnest(string_to_array(lower(coalesce(v_closed_days, '')), ',')) as d(value)
      where trim(d.value) = any (
        case v_weekday
          when 0 then array['0','sunday','domingo','domingo-feira']
          when 1 then array['1','monday','segunda','segunda-feira']
          when 2 then array['2','tuesday','terca','terça','terca-feira','terça-feira']
          when 3 then array['3','wednesday','quarta','quarta-feira']
          when 4 then array['4','thursday','quinta','quinta-feira']
          when 5 then array['5','friday','sexta','sexta-feira']
          when 6 then array['6','saturday','sabado','sábado','sábado-feira']
        end
      )
    ) into v_closed;

    if v_closed then
      v_day_schedule := jsonb_build_object(
        'day_off', true,
        'work_intervals', '[]'::jsonb,
        'break_intervals', '[]'::jsonb
      );
    else
      v_open_time := coalesce(v_open_time, time '09:00');
      v_close_time := coalesce(v_close_time, time '19:00');
      v_day_schedule := jsonb_build_object(
        'day_off', false,
        'work_intervals',
          case when v_open_time < v_close_time then
            jsonb_build_array(jsonb_build_object(
              'start', left(v_open_time::text, 5),
              'end', left(v_close_time::text, 5)
            ))
          else '[]'::jsonb end,
        'break_intervals',
          case
            when v_lunch_start is not null
              and v_lunch_end is not null
              and v_lunch_start < v_lunch_end
              and v_lunch_start >= v_open_time
              and v_lunch_end <= v_close_time
            then jsonb_build_array(jsonb_build_object(
              'start', left(v_lunch_start::text, 5),
              'end', left(v_lunch_end::text, 5)
            ))
            else '[]'::jsonb
          end
      );
    end if;
  end if;

  if coalesce((v_day_schedule ->> 'day_off')::boolean, false) then
    raise exception using errcode = 'P0001',
      message = case when p_professional_id is null
        then 'BARBERSHOP_CLOSED_DAY'
        else 'PROFESSIONAL_DAY_OFF'
      end;
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'work_intervals', '[]'::jsonb)
    ) as work_period(value)
    where
      v_requested_start >=
        split_part(work_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'start', ':', 2)::integer
      and v_requested_end <=
        split_part(work_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'end', ':', 2)::integer
  ) into v_within_work_period;

  if not v_within_work_period then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OUTSIDE_WORKING_HOURS';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'break_intervals', '[]'::jsonb)
    ) as break_period(value)
    where
      v_requested_start <
        split_part(break_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'end', ':', 2)::integer
      and v_requested_end >
        split_part(break_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'start', ':', 2)::integer
  ) into v_overlaps_break;

  if v_overlaps_break then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OVERLAPS_BREAK';
  end if;

  -- Internal manual bookings retain their own confirmation setting.
  -- Public requests still respect auto-confirm, except MB WAY prepayments:
  -- those must always remain pending until the barber reviews the payment.
  if lower(trim(coalesce(p_status, 'scheduled'))) = 'manual' then
    v_status := case
      when v_auto_confirm_manual then 'scheduled'::public.appointment_status
      else 'pending'::public.appointment_status
    end;
  elsif v_auto_confirm and not v_is_prepayment then
    v_status := 'scheduled'::public.appointment_status;
  end if;

  select coalesce(s.price, 0)::numeric(12,2)
    into v_payment_amount
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  if v_is_prepayment and coalesce(v_payment_amount, 0) <= 0 then
    raise exception using errcode = '22023', message = 'BOOKING_PREPAYMENT_AMOUNT_INVALID';
  end if;

  if p_professional_id is not null and not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.barbershop_id = p_barbershop_id
      and p.active = true
  ) then
    raise exception using errcode = '22023', message = 'BOOKING_PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An expired MB WAY hold no longer owns the slot, even if the expiry
      -- worker has not yet run and changed its status to cancelled.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
      )
      and a.date_hour < p_date_hour + make_interval(mins => v_duration)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
      ) > p_date_hour
      and (
        p_professional_id is null
        or a.professional_id is null
        or a.professional_id = p_professional_id
      )
  ) into v_existing;

  if v_existing then
    raise exception using errcode = '23P01', message = 'BOOKING_CONFLICT';
  end if;

  if v_email is not null and length(v_phone) >= 7 then
    select u.id
      into v_client_id
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and lower(trim(coalesce(u.email, ''))) = v_email
      and (
        case
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 2) = '00'
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 3)
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 3) = '351'
               and length(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')) = 12
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 4)
          else regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')
        end
      ) = v_phone
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.appointments (
    barbershop_id,
    client_id,
    service_id,
    professional_id,
    date_hour,
    status,
    manual_name,
    manual_phone,
    manual_email,
    manual_birth_date,
    duration_minutes,
    payment_method,
    payment_status,
    payment_amount,
    payment_expires_at
  )
  values (
    p_barbershop_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_date_hour,
    v_status,
    nullif(left(trim(coalesce(p_manual_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_manual_phone, '')), 40), ''),
    v_email,
    p_manual_birth_date,
    v_duration,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$;

revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) to service_role;

comment on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) is
  'Atomic tenant-scoped public booking creation with MB WAY prepayment holds, expiry-aware conflict checks, client matching and separate manual/online auto-confirmation settings.';

notify pgrst, 'reload schema';

commit;

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

-- Ensure the atomic booking RPC respects the chosen barber's weekly schedule.

-- Reconcile the public booking RPC after the manual-booking auto-confirmation
-- migration replaced it with an older implementation that discarded MB WAY
-- prepayment metadata and treated "prepayment_pending" as a confirmed booking.
create or replace function public.create_booking_atomic(
  p_barbershop_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_date_hour timestamptz,
  p_duration_minutes integer,
  p_manual_name text,
  p_manual_phone text,
  p_manual_email text,
  p_manual_birth_date date,
  p_status text default 'scheduled'
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_status public.appointment_status := case
    when lower(trim(coalesce(p_status, 'scheduled'))) in ('pending', 'prepayment_pending')
      then 'pending'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
  v_email text := lower(nullif(trim(coalesce(p_manual_email, '')), ''));
  v_phone_digits text := regexp_replace(coalesce(p_manual_phone, ''), '[^0-9]', '', 'g');
  v_phone text;
  v_weekday integer;
  v_day_key text;
  v_weekly_schedule jsonb;
  v_day_schedule jsonb;
  v_closed boolean := false;
  v_closed_days text;
  v_open_time time;
  v_close_time time;
  v_lunch_start time;
  v_lunch_end time;
  v_requested_start integer;
  v_requested_end integer;
  v_within_work_period boolean := false;
  v_overlaps_break boolean := false;
  v_auto_confirm boolean := false;
  v_auto_confirm_manual boolean := true;
  v_is_prepayment boolean :=
    lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
  v_payment_amount numeric(12,2);
begin
  if p_barbershop_id is null or p_service_id is null or p_date_hour is null then
    raise exception using errcode = '22023', message = 'BOOKING_REQUIRED_FIELDS';
  end if;

  v_phone := case
    when left(v_phone_digits, 2) = '00' then substring(v_phone_digits from 3)
    when left(v_phone_digits, 3) = '351' and length(v_phone_digits) = 12 then substring(v_phone_digits from 4)
    else v_phone_digits
  end;

  select
    coalesce(p.weekly_schedule, b.weekly_schedule),
    b.opening_time,
    b.closing_time,
    b.lunch_start,
    b.lunch_end,
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_weekly_schedule,
    v_open_time,
    v_close_time,
    v_lunch_start,
    v_lunch_end,
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  left join public.professionals p
    on p.id = p_professional_id
    and p.barbershop_id = b.id
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_day_key := case v_weekday
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    else 'saturday'
  end;
  v_day_schedule := v_weekly_schedule -> v_day_key;

  -- New shops created after this migration may not have been backfilled yet.
  -- For those, retain the current legacy settings as a safe fallback.
  if v_day_schedule is null then
    select exists (
      select 1
      from unnest(string_to_array(lower(coalesce(v_closed_days, '')), ',')) as d(value)
      where trim(d.value) = any (
        case v_weekday
          when 0 then array['0','sunday','domingo','domingo-feira']
          when 1 then array['1','monday','segunda','segunda-feira']
          when 2 then array['2','tuesday','terca','terça','terca-feira','terça-feira']
          when 3 then array['3','wednesday','quarta','quarta-feira']
          when 4 then array['4','thursday','quinta','quinta-feira']
          when 5 then array['5','friday','sexta','sexta-feira']
          when 6 then array['6','saturday','sabado','sábado','sábado-feira']
        end
      )
    ) into v_closed;

    if v_closed then
      v_day_schedule := jsonb_build_object(
        'day_off', true,
        'work_intervals', '[]'::jsonb,
        'break_intervals', '[]'::jsonb
      );
    else
      v_open_time := coalesce(v_open_time, time '09:00');
      v_close_time := coalesce(v_close_time, time '19:00');
      v_day_schedule := jsonb_build_object(
        'day_off', false,
        'work_intervals',
          case when v_open_time < v_close_time then
            jsonb_build_array(jsonb_build_object(
              'start', left(v_open_time::text, 5),
              'end', left(v_close_time::text, 5)
            ))
          else '[]'::jsonb end,
        'break_intervals',
          case
            when v_lunch_start is not null
              and v_lunch_end is not null
              and v_lunch_start < v_lunch_end
              and v_lunch_start >= v_open_time
              and v_lunch_end <= v_close_time
            then jsonb_build_array(jsonb_build_object(
              'start', left(v_lunch_start::text, 5),
              'end', left(v_lunch_end::text, 5)
            ))
            else '[]'::jsonb
          end
      );
    end if;
  end if;

  if coalesce((v_day_schedule ->> 'day_off')::boolean, false) then
    raise exception using errcode = 'P0001',
      message = case when p_professional_id is null
        then 'BARBERSHOP_CLOSED_DAY'
        else 'PROFESSIONAL_DAY_OFF'
      end;
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'work_intervals', '[]'::jsonb)
    ) as work_period(value)
    where
      v_requested_start >=
        split_part(work_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'start', ':', 2)::integer
      and v_requested_end <=
        split_part(work_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(work_period.value ->> 'end', ':', 2)::integer
  ) into v_within_work_period;

  if not v_within_work_period then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OUTSIDE_WORKING_HOURS';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(
      coalesce(v_day_schedule -> 'break_intervals', '[]'::jsonb)
    ) as break_period(value)
    where
      v_requested_start <
        split_part(break_period.value ->> 'end', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'end', ':', 2)::integer
      and v_requested_end >
        split_part(break_period.value ->> 'start', ':', 1)::integer * 60
        + split_part(break_period.value ->> 'start', ':', 2)::integer
  ) into v_overlaps_break;

  if v_overlaps_break then
    raise exception using errcode = 'P0001',
      message = 'BOOKING_OVERLAPS_BREAK';
  end if;

  -- Internal manual bookings retain their own confirmation setting.
  -- Public requests still respect auto-confirm, except MB WAY prepayments:
  -- those must always remain pending until the barber reviews the payment.
  if lower(trim(coalesce(p_status, 'scheduled'))) = 'manual' then
    v_status := case
      when v_auto_confirm_manual then 'scheduled'::public.appointment_status
      else 'pending'::public.appointment_status
    end;
  elsif v_auto_confirm and not v_is_prepayment then
    v_status := 'scheduled'::public.appointment_status;
  end if;

  select coalesce(s.price, 0)::numeric(12,2)
    into v_payment_amount
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  if v_is_prepayment and coalesce(v_payment_amount, 0) <= 0 then
    raise exception using errcode = '22023', message = 'BOOKING_PREPAYMENT_AMOUNT_INVALID';
  end if;

  if p_professional_id is not null and not exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.barbershop_id = p_barbershop_id
      and p.active = true
  ) then
    raise exception using errcode = '22023', message = 'BOOKING_PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select exists (
    select 1
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An expired MB WAY hold no longer owns the slot, even if the expiry
      -- worker has not yet run and changed its status to cancelled.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
      )
      and a.date_hour < p_date_hour + make_interval(mins => v_duration)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
      ) > p_date_hour
      and (
        p_professional_id is null
        or a.professional_id is null
        or a.professional_id = p_professional_id
      )
  ) into v_existing;

  if v_existing then
    raise exception using errcode = '23P01', message = 'BOOKING_CONFLICT';
  end if;

  if v_email is not null and length(v_phone) >= 7 then
    select u.id
      into v_client_id
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and lower(trim(coalesce(u.email, ''))) = v_email
      and (
        case
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 2) = '00'
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 3)
          when left(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g'), 3) = '351'
               and length(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')) = 12
            then substring(regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') from 4)
          else regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g')
        end
      ) = v_phone
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.appointments (
    barbershop_id,
    client_id,
    service_id,
    professional_id,
    date_hour,
    status,
    manual_name,
    manual_phone,
    manual_email,
    manual_birth_date,
    duration_minutes,
    payment_method,
    payment_status,
    payment_amount,
    payment_expires_at
  )
  values (
    p_barbershop_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    p_date_hour,
    v_status,
    nullif(left(trim(coalesce(p_manual_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_manual_phone, '')), 40), ''),
    v_email,
    p_manual_birth_date,
    v_duration,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$;

revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) to service_role;

comment on function public.create_booking_atomic(
  uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text
) is
  'Atomic tenant-scoped public booking creation with MB WAY prepayment holds, expiry-aware conflict checks, client matching and separate manual/online auto-confirmation settings.';

notify pgrst, 'reload schema';

commit;

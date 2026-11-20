begin;

-- Rollback: drop the two new triggers and their functions, drop the buffer
-- columns, then restore create_booking_atomic from
-- 20261114002250_weekly_barber_schedules.sql, the capacity trigger from
-- 20261119232316_enforce_cross_lane_appointment_capacity.sql, and the schedule
-- block trigger functions from 20261120173000_enforce_schedule_block_capacity.sql.

alter table public.services
  add column if not exists buffer_minutes smallint not null default 0;
alter table public.appointments
  add column if not exists buffer_minutes smallint not null default 0;

alter table public.services
  drop constraint if exists services_buffer_minutes_range;
alter table public.services
  add constraint services_buffer_minutes_range
  check (buffer_minutes between 0 and 120);
alter table public.appointments
  drop constraint if exists appointments_buffer_minutes_range;
alter table public.appointments
  add constraint appointments_buffer_minutes_range
  check (buffer_minutes between 0 and 120);

create or replace function public.serialize_service_buffer_update()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if new.barbershop_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.barbershop_id::text, 0)
    );
  end if;
  return new;
end;
$function$;

create or replace function public.populate_appointment_service_buffer()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_buffer integer := 0;
begin
  if new.barbershop_id is null or new.service_id is null then
    new.buffer_minutes := 0;
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  select greatest(0, least(coalesce(service.buffer_minutes, 0), 120))
    into v_buffer
  from public.services as service
  where service.id = new.service_id
    and service.barbershop_id = new.barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  new.buffer_minutes := v_buffer;
  return new;
end;
$function$;

drop trigger if exists a_serialize_service_buffer_update on public.services;
create trigger a_serialize_service_buffer_update
before update of buffer_minutes on public.services
for each row execute function public.serialize_service_buffer_update();

drop trigger if exists a_populate_appointment_service_buffer on public.appointments;
create trigger a_populate_appointment_service_buffer
before insert or update of service_id, barbershop_id on public.appointments
for each row execute function public.populate_appointment_service_buffer();

CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_barbershop_id uuid, p_service_id uuid, p_professional_id uuid, p_date_hour timestamp with time zone, p_duration_minutes integer, p_manual_name text, p_manual_phone text, p_manual_email text, p_manual_birth_date date, p_status text DEFAULT 'scheduled'::text)
 RETURNS appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_appointment public.appointments;
  v_existing boolean;
  v_client_id uuid;
  v_duration integer := greatest(1, least(coalesce(p_duration_minutes, 30), 1440));
  v_buffer integer := 0;
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

  -- Lock the tenant before reading service buffer settings so a concurrent
  -- service-buffer edit cannot race with a new booking.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text, 0)
  );

  select
    coalesce(s.price, 0)::numeric(12,2),
    greatest(0, least(coalesce(s.buffer_minutes, 0), 120))
    into v_payment_amount, v_buffer
  from public.services s
  where s.id = p_service_id
    and s.barbershop_id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  v_requested_start :=
    extract(hour from (p_date_hour at time zone 'Europe/Lisbon'))::integer * 60
    + extract(minute from (p_date_hour at time zone 'Europe/Lisbon'))::integer;
  v_requested_end := v_requested_start + v_duration + v_buffer;

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
      and a.date_hour < p_date_hour + make_interval(mins => v_duration + v_buffer)
      and a.date_hour + make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440)) + greatest(0, coalesce(a.buffer_minutes, 0))
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
    buffer_minutes,
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
    v_buffer,
    case when v_is_prepayment then 'mbway' else null end,
    case when v_is_prepayment then 'awaiting_review' else null end,
    case when v_is_prepayment then v_payment_amount else null end,
    case when v_is_prepayment then now() + interval '15 minutes' else null end
  )
  returning * into v_appointment;

  return v_appointment;
end;
$function$


CREATE OR REPLACE FUNCTION public.enforce_appointment_capacity_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status not in (
    'pending'::public.appointment_status,
    'scheduled'::public.appointment_status
  ) or (
    new.payment_status = 'awaiting_review'
    and new.payment_expires_at is not null
    and new.payment_expires_at <= pg_catalog.now()
  ) then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments a
    where a.barbershop_id = new.barbershop_id
      and a.id is distinct from new.id
      and a.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= pg_catalog.now()
      )
      and a.date_hour < new.date_hour + pg_catalog.make_interval(
        mins => greatest(1, least(coalesce(new.duration_minutes, 30), 1440)) + greatest(0, coalesce(new.buffer_minutes, 0))
      )
      and a.date_hour + pg_catalog.make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440)) + greatest(0, coalesce(a.buffer_minutes, 0))
      ) > new.date_hour
      and (
        new.professional_id is null
        or a.professional_id is null
        or a.professional_id = new.professional_id
      )
  ) then
    raise exception using
      errcode = '23P01',
      message = 'BOOKING_CONFLICT';
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.enforce_appointment_schedule_block_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_start timestamp without time zone;
  v_end timestamp without time zone;
  v_duration integer;
begin
  if new.barbershop_id is null or new.date_hour is null then
    return new;
  end if;

  if new.status not in (
    'pending'::public.appointment_status,
    'scheduled'::public.appointment_status
  ) then
    return new;
  end if;

  -- Serialize appointment and block writes with the same tenant lock used by
  -- create_booking_atomic and the cross-lane capacity guard.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  v_start := new.date_hour at time zone 'Europe/Lisbon';
  v_duration := greatest(1, least(coalesce(new.duration_minutes, 30), 1440)) + greatest(0, coalesce(new.buffer_minutes, 0));
  v_end := v_start + pg_catalog.make_interval(mins => v_duration);

  if exists (
    select 1
    from public.schedule_blocks as block
    where block.barbershop_id = new.barbershop_id
      and block.date between v_start::date and v_end::date
      -- An unassigned booking reserves capacity across the entire shop.
      -- An assigned booking only conflicts with its own professional's block.
      and (
        new.professional_id is null
        or block.professional_id is null
        or block.professional_id = new.professional_id
      )
      and (
        (block.start_time is null or block.end_time is null)
        or (
          (block.date + block.start_time) < v_end
          and (block.date + block.end_time) > v_start
        )
      )
  ) then
    raise exception using
      errcode = '23P01',
      message = 'BOOKING_CONFLICT';
  end if;

  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.enforce_schedule_block_no_appointment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_block_start timestamp without time zone;
  v_block_end timestamp without time zone;
begin
  if new.barbershop_id is null or new.date is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  if new.start_time is null or new.end_time is null then
    v_block_start := new.date::timestamp;
    v_block_end := (new.date + 1)::timestamp;
  else
    v_block_start := new.date + new.start_time;
    v_block_end := new.date + new.end_time;
  end if;

  if v_block_end <= v_block_start then
    raise exception using
      errcode = '22023',
      message = 'INVALID_SCHEDULE_BLOCK_INTERVAL';
  end if;

  if exists (
    select 1
    from public.appointments as appointment
    where appointment.barbershop_id = new.barbershop_id
      and appointment.status in (
        'pending'::public.appointment_status,
        'scheduled'::public.appointment_status
      )
      -- An unassigned appointment reserves every professional's capacity.
      and (
        new.professional_id is null
        or appointment.professional_id is null
        or appointment.professional_id = new.professional_id
      )
      and appointment.date_hour < (v_block_end at time zone 'Europe/Lisbon')
      and (
        appointment.date_hour
        + pg_catalog.make_interval(
            mins => greatest(1, least(coalesce(appointment.duration_minutes, 30), 1440)) + greatest(0, coalesce(appointment.buffer_minutes, 0))
          )
      ) > (v_block_start at time zone 'Europe/Lisbon')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'SCHEDULE_BLOCK_OVERLAPS_APPOINTMENT';
  end if;

  return new;
end;
$function$


revoke all on function public.serialize_service_buffer_update()
  from public, anon, authenticated, service_role;
revoke all on function public.populate_appointment_service_buffer()
  from public, anon, authenticated, service_role;
revoke all on function public.create_booking_atomic(uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.create_booking_atomic(uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text)
  to service_role;
revoke all on function public.enforce_appointment_capacity_overlap()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_appointment_schedule_block_capacity()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_schedule_block_no_appointment_overlap()
  from public, anon, authenticated, service_role;

comment on column public.services.buffer_minutes is 'Additional minutes reserved after the service for preparation or cleanup.';
comment on column public.appointments.buffer_minutes is 'Snapshot of the service buffer reserved when this appointment was created.';

notify pgrst, 'reload schema';
commit;

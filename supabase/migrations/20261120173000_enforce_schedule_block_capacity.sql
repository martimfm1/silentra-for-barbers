begin;

-- Rollback: drop the two triggers from public.appointments and public.schedule_blocks,
-- then drop public.enforce_appointment_schedule_block_capacity() and
-- public.enforce_schedule_block_no_appointment_overlap().

create or replace function public.enforce_appointment_schedule_block_capacity()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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
  v_duration := greatest(1, least(coalesce(new.duration_minutes, 30), 1440));
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
$function$;

create or replace function public.enforce_schedule_block_no_appointment_overlap()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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
            mins => greatest(1, least(coalesce(appointment.duration_minutes, 30), 1440))
          )
      ) > (v_block_start at time zone 'Europe/Lisbon')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'SCHEDULE_BLOCK_OVERLAPS_APPOINTMENT';
  end if;

  return new;
end;
$function$;

drop trigger if exists b_enforce_appointment_schedule_block_capacity
  on public.appointments;
create trigger b_enforce_appointment_schedule_block_capacity
before insert or update of
  barbershop_id, professional_id, date_hour, duration_minutes, status
on public.appointments
for each row
execute function public.enforce_appointment_schedule_block_capacity();

drop trigger if exists b_enforce_schedule_block_no_appointment_overlap
  on public.schedule_blocks;
create trigger b_enforce_schedule_block_no_appointment_overlap
before insert or update of
  barbershop_id, professional_id, date, start_time, end_time
on public.schedule_blocks
for each row
execute function public.enforce_schedule_block_no_appointment_overlap();

revoke all on function public.enforce_appointment_schedule_block_capacity()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_schedule_block_no_appointment_overlap()
  from public, anon, authenticated, service_role;

comment on function public.enforce_appointment_schedule_block_capacity()
  is 'Rejects appointment writes that overlap a schedule block, using the barbershop capacity lock.';
comment on function public.enforce_schedule_block_no_appointment_overlap()
  is 'Rejects schedule blocks that would overlap an active appointment, using the barbershop capacity lock.';

notify pgrst, 'reload schema';
commit;

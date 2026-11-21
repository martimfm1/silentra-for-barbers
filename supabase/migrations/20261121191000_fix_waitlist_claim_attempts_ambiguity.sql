begin;

-- Rollback: restore the previous public.claim_booking_waitlist_vacancies(integer)
-- definition from 20261121183504_service_buffer_capacity.sql.

create or replace function public.claim_booking_waitlist_vacancies(p_batch_size integer default 25)
returns table (
  vacancy_id uuid,
  waitlist_id uuid,
  shop_id uuid,
  service_id uuid,
  professional_id uuid,
  barbershop_id uuid,
  preferred_date date,
  offered_time time,
  offer_expires_at timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_name text,
  professional_name text,
  shop_name text,
  default_language text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vacancy record;
  v_waitlist_id uuid;
  v_expiry timestamptz;
  v_retry_at timestamptz;
begin
  perform public.recover_stale_booking_waitlist_offers();

  for v_vacancy in
    select vacancy.*
    from public.booking_waitlist_vacancies as vacancy
    where vacancy.status = 'pending'
      and vacancy.available_at <= pg_catalog.now()
      and vacancy.slot_date <= (pg_catalog.now() at time zone 'Europe/Lisbon')::date + 13
      and vacancy.attempts < 5
    order by vacancy.created_at asc, vacancy.id asc
    limit greatest(1, least(coalesce(p_batch_size, 25), 100))
    for update skip locked
  loop
    v_retry_at := null;

    select max(coalesce(other.offer_expires_at, pg_catalog.now() + interval '1 minute'))
      into v_retry_at
    from public.booking_waitlist_vacancies as other
    where other.id <> v_vacancy.id
      and other.barbershop_id = v_vacancy.barbershop_id
      and other.slot_date = v_vacancy.slot_date
      and other.slot_time < v_vacancy.slot_time
        + pg_catalog.make_interval(mins => v_vacancy.duration_minutes)
      and other.slot_time + pg_catalog.make_interval(mins => other.duration_minutes)
        > v_vacancy.slot_time
      and (
        other.professional_id is null
        or v_vacancy.professional_id is null
        or other.professional_id = v_vacancy.professional_id
      )
      and other.status in ('dispatching', 'offered')
      and coalesce(other.offer_expires_at, pg_catalog.now() + interval '1 minute') > pg_catalog.now();

    if v_retry_at is not null then
      update public.booking_waitlist_vacancies as blocked_vacancy
      set status = 'pending',
          available_at = v_retry_at,
          updated_at = pg_catalog.now(),
          last_error = 'An overlapping offer is still active'
      where blocked_vacancy.id = v_vacancy.id;
      continue;
    end if;

    if exists (
      select 1
      from public.appointments as appointment
      where appointment.barbershop_id = v_vacancy.barbershop_id
        and appointment.id <> v_vacancy.appointment_id
        and appointment.status::text in ('pending', 'scheduled')
        and appointment.date_hour <
          ((v_vacancy.slot_date::text || ' ' || v_vacancy.slot_time::text)::timestamp at time zone 'UTC')
            + pg_catalog.make_interval(mins => v_vacancy.duration_minutes)
        and appointment.date_hour + pg_catalog.make_interval(
          mins => greatest(1, least(coalesce(appointment.duration_minutes, 30), 1440))
            + greatest(0, coalesce(appointment.buffer_minutes, 0))
        ) >
          ((v_vacancy.slot_date::text || ' ' || v_vacancy.slot_time::text)::timestamp at time zone 'UTC')
        and (
          v_vacancy.professional_id is null
          or appointment.professional_id is null
          or appointment.professional_id = v_vacancy.professional_id
        )
    ) or exists (
      select 1
      from public.schedule_blocks as block
      where block.barbershop_id = v_vacancy.barbershop_id
        and block.date = v_vacancy.slot_date
        and (block.professional_id is null or block.professional_id = v_vacancy.professional_id)
        and (
          block.start_time is null
          or block.end_time is null
          or (
            v_vacancy.slot_time < block.end_time
            and v_vacancy.slot_time
              + pg_catalog.make_interval(mins => v_vacancy.duration_minutes) > block.start_time
          )
        )
    ) then
      update public.booking_waitlist_vacancies as unavailable_vacancy
      set status = 'completed',
          updated_at = pg_catalog.now(),
          last_error = 'Slot is no longer available'
      where unavailable_vacancy.id = v_vacancy.id;
      continue;
    end if;

    v_waitlist_id := null;

    select waitlist.id
      into v_waitlist_id
    from public.booking_waitlist as waitlist
    join public.services as service
      on service.id = waitlist.service_id
     and service.barbershop_id = waitlist.barbershop_id
     and service.is_active = true
    left join public.professionals as professional
      on professional.id = waitlist.professional_id
     and professional.barbershop_id = waitlist.barbershop_id
     and professional.active = true
    where waitlist.barbershop_id = v_vacancy.barbershop_id
      and waitlist.shop_id = v_vacancy.shop_id
      and waitlist.service_id = v_vacancy.service_id
      and waitlist.preferred_date = v_vacancy.slot_date
      and waitlist.status = 'waiting'
      and (waitlist.professional_id is null or waitlist.professional_id = v_vacancy.professional_id)
      and (waitlist.professional_id is null or professional.id is not null)
      and (
        waitlist.preferred_time_start is null
        or (
          v_vacancy.slot_time >= waitlist.preferred_time_start
          and v_vacancy.slot_time < waitlist.preferred_time_end
        )
      )
    order by waitlist.created_at asc, waitlist.id asc
    limit 1
    for update of waitlist skip locked;

    if v_waitlist_id is null then
      update public.booking_waitlist_vacancies as unmatched_vacancy
      set status = 'no_match',
          updated_at = pg_catalog.now(),
          last_error = null
      where unmatched_vacancy.id = v_vacancy.id;
      continue;
    end if;

    v_expiry := pg_catalog.now() + interval '20 minutes';

    update public.booking_waitlist as offered_waitlist
    set status = 'offered',
        offered_date = v_vacancy.slot_date,
        offered_time = v_vacancy.slot_time,
        offer_expires_at = v_expiry,
        last_contacted_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    where offered_waitlist.id = v_waitlist_id
      and offered_waitlist.status = 'waiting';

    -- Qualify the source column: RETURNS TABLE exposes an output variable
    -- named "attempts", which made the former "attempts = attempts + 1"
    -- expression ambiguous at runtime.
    update public.booking_waitlist_vacancies as claimed_vacancy
    set status = 'dispatching',
        waitlist_id = v_waitlist_id,
        offer_expires_at = v_expiry,
        locked_at = pg_catalog.now(),
        attempts = claimed_vacancy.attempts + 1,
        updated_at = pg_catalog.now(),
        last_error = null
    where claimed_vacancy.id = v_vacancy.id;

    return query
    select
      v_vacancy.id,
      offered_waitlist.id,
      offered_waitlist.shop_id,
      offered_waitlist.service_id,
      v_vacancy.professional_id,
      offered_waitlist.barbershop_id,
      offered_waitlist.offered_date,
      offered_waitlist.offered_time,
      offered_waitlist.offer_expires_at,
      offered_waitlist.customer_name,
      offered_waitlist.customer_email,
      offered_waitlist.customer_phone,
      service.name::text,
      professional.name::text,
      shop.name::text,
      coalesce(barbershop.default_language, 'pt')::text,
      v_vacancy.attempts + 1
    from public.booking_waitlist as offered_waitlist
    join public.services as service on service.id = offered_waitlist.service_id
    left join public.professionals as professional on professional.id = v_vacancy.professional_id
    join public.shops as shop on shop.id = offered_waitlist.shop_id
    join public.barbershops as barbershop on barbershop.id = offered_waitlist.barbershop_id
    where offered_waitlist.id = v_waitlist_id;
  end loop;
end;
$function$;

notify pgrst, 'reload schema';
commit;

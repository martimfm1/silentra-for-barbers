begin;

-- The GiST exclusion constraint reserves a separate lane for NULL professional
-- IDs. It cannot express the rule that an unassigned booking conflicts with
-- every barber. Serialize all active appointment writes per barbershop and
-- enforce the cross-lane rule after the row changes are visible.
create or replace function public.enforce_appointment_capacity_overlap()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if new.status not in (
    'pending'::public.appointment_status,
    'scheduled'::public.appointment_status
  ) then
    return new;
  end if;

  -- Use the same transaction-level lock key as create_booking_atomic so
  -- public booking creation and direct INSERT/UPDATE paths share one gate.
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
      and a.date_hour < new.date_hour + pg_catalog.make_interval(
        mins => greatest(1, least(coalesce(new.duration_minutes, 30), 1440))
      )
      and a.date_hour + pg_catalog.make_interval(
        mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))
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
$function$;

revoke all on function public.enforce_appointment_capacity_overlap()
  from public, anon, authenticated, service_role;

drop trigger if exists zz_enforce_appointment_capacity_overlap
  on public.appointments;

-- AFTER ROW runs after the full INSERT/UPDATE statement is visible. This also
-- catches conflicts created by multi-row statements, then rolls the statement
-- back if one of the final rows overlaps another active booking.
create trigger zz_enforce_appointment_capacity_overlap
after insert or update of
  barbershop_id,
  professional_id,
  date_hour,
  duration_minutes,
  status
on public.appointments
for each row
execute function public.enforce_appointment_capacity_overlap();

comment on function public.enforce_appointment_capacity_overlap() is
  'Serializes active appointment writes per barbershop and rejects overlaps whenever either booking is unassigned or both target the same professional.';

comment on trigger zz_enforce_appointment_capacity_overlap
  on public.appointments is
  'Database-level cross-professional overlap guard for inserts, reschedules and appointment capacity changes.';

commit;

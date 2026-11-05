-- Prevent two active appointments from occupying the same barbershop slot.
-- Completed/cancelled appointments do not block the slot for future bookings.

-- Fail clearly if existing production data already contains conflicting active slots.
do $$
declare
  duplicate_count integer;
begin
  select count(*)
    into duplicate_count
  from (
    select barbershop_id, date_hour
    from public.appointments
    where status in ('pending', 'scheduled')
    group by barbershop_id, date_hour
    having count(*) > 1
  ) conflicts;

  if duplicate_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'Cannot create the unique active booking index: %s barbershop/time conflicts already exist. Resolve duplicate pending/scheduled appointments first.',
        duplicate_count
      );
  end if;
end $$;

create unique index if not exists appointments_active_slot_unique_idx
  on public.appointments (barbershop_id, date_hour)
  where status in ('pending', 'scheduled');

comment on index public.appointments_active_slot_unique_idx is
  'Prevents duplicate active bookings for the same barbershop date/time slot.';

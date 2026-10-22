begin;

-- Production appointments do not have an updated_at column.
-- Keep the completion worker compatible with the deployed schema.
create or replace function public.process_automatic_booking_completion()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.appointments a
  set status = 'completed'
  from public.barbershops b
  where a.barbershop_id = b.id
    and coalesce(b.auto_complete_bookings, false) = true
    and a.status = 'scheduled'
    and a.date_hour
      + make_interval(mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440)))
      <= now();

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.process_automatic_booking_completion()
from public, anon, authenticated;
grant execute on function public.process_automatic_booking_completion()
to service_role;

commit;

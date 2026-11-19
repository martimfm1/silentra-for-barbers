-- Rollback:
-- Re-apply the previous CREATE OR REPLACE FUNCTION definition from
-- supabase/migrations/20261119232316_enforce_cross_lane_appointment_capacity.sql.
-- The trigger and its privileges remain unchanged by this function-only update.

begin;

-- Keep expiry semantics identical to create_booking_atomic: an MB WAY hold
-- awaiting review stops reserving capacity as soon as its expiry timestamp
-- passes, even if the asynchronous expiry worker has not cancelled it yet.
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
  ) or (
    new.payment_status = 'awaiting_review'
    and new.payment_expires_at is not null
    and new.payment_expires_at <= now()
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
      -- Match create_booking_atomic: expired MB WAY holds no longer reserve
      -- the slot while the expiry worker catches up.
      and not (
        a.payment_status = 'awaiting_review'
        and a.payment_expires_at is not null
        and a.payment_expires_at <= now()
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

comment on function public.enforce_appointment_capacity_overlap() is
  'Serializes active appointment writes per barbershop, rejects cross-lane overlaps and ignores MB WAY holds whose review window has expired.';

commit;

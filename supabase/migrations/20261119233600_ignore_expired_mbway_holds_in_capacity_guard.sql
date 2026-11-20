-- Rollback:
-- DROP TRIGGER IF EXISTS a_release_expired_mbway_holds_before_capacity_check
--   ON public.appointments;
-- DROP FUNCTION IF EXISTS public.release_expired_mbway_holds_before_capacity_check();
-- Restore the previous enforce_appointment_capacity_overlap() definition from
-- 20261119232316_enforce_cross_lane_appointment_capacity.sql if reverting the
-- expiry-aware AFTER-trigger implementation as well.

begin;

-- Exclusion constraints are checked before AFTER triggers. Therefore simply
-- ignoring expired holds in the AFTER trigger is insufficient: expire matching
-- holds for this barbershop in a BEFORE trigger, using the same advisory lock
-- as create_booking_atomic and the cross-lane capacity guard.
create or replace function public.release_expired_mbway_holds_before_capacity_check()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_exclude_id uuid;
begin
  -- The UPDATE below fires this trigger recursively. Nested executions must
  -- not run another cleanup pass.
  if pg_catalog.pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.status not in (
    'pending'::public.appointment_status,
    'scheduled'::public.appointment_status
  ) then
    return new;
  end if;

  -- An expired MB WAY payment cannot be revived by moving its appointment.
  if tg_op = 'UPDATE'
    and old.payment_method = 'mbway'
    and old.payment_status in ('awaiting_review', 'expired')
    and old.payment_expires_at is not null
    and old.payment_expires_at <= pg_catalog.now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'MBWAY_PREPAYMENT_EXPIRED';
  end if;

  if new.payment_status = 'awaiting_review'
    and new.payment_expires_at is not null
    and new.payment_expires_at <= pg_catalog.now()
  then
    raise exception using
      errcode = 'P0001',
      message = 'MBWAY_PREPAYMENT_EXPIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  v_exclude_id := case when tg_op = 'UPDATE' then old.id else null end;

  -- Keep this transition identical to expire_manual_mbway_prepayments().
  -- Existing AFTER UPDATE triggers still enqueue waitlist vacancy events.
  update public.appointments a
  set
    status = 'cancelled'::public.appointment_status,
    payment_status = 'expired',
    cancelled_at = pg_catalog.now(),
    cancellation_reason = 'Pré-pagamento MB WAY não validado dentro do prazo.'
  where a.barbershop_id = new.barbershop_id
    and a.id is distinct from v_exclude_id
    and a.status = 'pending'::public.appointment_status
    and a.payment_status = 'awaiting_review'
    and a.payment_expires_at is not null
    and a.payment_expires_at <= pg_catalog.now();

  return new;
end;
$function$;

revoke all on function public.release_expired_mbway_holds_before_capacity_check()
  from public, anon, authenticated, service_role;

drop trigger if exists a_release_expired_mbway_holds_before_capacity_check
  on public.appointments;

create trigger a_release_expired_mbway_holds_before_capacity_check
before insert or update of
  barbershop_id, professional_id, date_hour, duration_minutes, status
on public.appointments
for each row
execute function public.release_expired_mbway_holds_before_capacity_check();

comment on function public.release_expired_mbway_holds_before_capacity_check() is
  'Expires stale MB WAY holds for the same barbershop before the appointments exclusion constraint checks capacity; preserves cancellation and waitlist triggers.';

-- Keep the AFTER guard consistent with the same expiry semantics for writes
-- that do not pass through the exclusion constraint in future schema versions.
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

commit;

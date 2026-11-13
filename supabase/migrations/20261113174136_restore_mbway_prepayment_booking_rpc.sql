begin;

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
  v_closed boolean := false;
  v_closed_days text;
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
    coalesce(b.closed_days, ''),
    coalesce(b.auto_confirm_bookings, false),
    coalesce(b.auto_confirm_manual_bookings, true)
  into
    v_closed_days,
    v_auto_confirm,
    v_auto_confirm_manual
  from public.barbershops b
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_weekday := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;

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
    raise exception using errcode = 'P0001', message = 'BARBERSHOP_CLOSED_DAY';
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

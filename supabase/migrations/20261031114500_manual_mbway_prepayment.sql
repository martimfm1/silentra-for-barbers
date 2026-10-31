begin;

alter table public.barbershops
  add column if not exists mbway_enabled boolean not null default false,
  add column if not exists mbway_phone text;

alter table public.appointments
  add column if not exists payment_status text,
  add column if not exists payment_amount numeric(12,2),
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_reviewed_at timestamptz;

do $mbway$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_payment_status_check'
  ) then
    alter table public.appointments
      add constraint appointments_payment_status_check
      check (payment_status is null or payment_status in ('awaiting_review', 'confirmed', 'rejected', 'expired'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_payment_amount_nonnegative_check'
  ) then
    alter table public.appointments
      add constraint appointments_payment_amount_nonnegative_check
      check (payment_amount is null or payment_amount >= 0);
  end if;
end;
$mbway$;

create index if not exists appointments_mbway_expiry_idx
  on public.appointments (payment_expires_at)
  where status = 'pending' and payment_status = 'awaiting_review';

create or replace function public.update_barbershop_mbway_settings(
  p_barbershop_id uuid,
  p_enabled boolean,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_whatsapp_phone text;
  v_current_mbway_enabled boolean;
  v_current_mbway_phone text;
  v_target_mbway_enabled boolean;
  v_target_mbway_phone text;
  v_mbway_digits text;
  v_whatsapp_digits text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null then
    raise exception 'invalid barbershop';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.barbershop_id = p_barbershop_id
      and u.role in ('owner', 'admin')
  ) then
    raise exception 'barbershop update not permitted';
  end if;

  select
    coalesce(b.mbway_enabled, false),
    b.mbway_phone,
    b.phone
  into
    v_current_mbway_enabled,
    v_current_mbway_phone,
    v_whatsapp_phone
  from public.barbershops b
  where b.id = p_barbershop_id;

  if not found then
    raise exception 'barbershop not found';
  end if;

  v_target_mbway_enabled := coalesce(p_enabled, v_current_mbway_enabled);
  v_target_mbway_phone := case
    when p_phone is not null then nullif(btrim(p_phone), '')
    else v_current_mbway_phone
  end;

  v_plan := public.get_effective_billing_plan_for_barbershop(p_barbershop_id);
  if v_target_mbway_enabled
     and coalesce(v_plan, 'free') not in ('pro', 'enterprise') then
    raise exception using errcode = '42501', message = 'MBWAY_PREPAYMENT_PRO_REQUIRED';
  end if;

  v_mbway_digits := regexp_replace(coalesce(v_target_mbway_phone, ''), '[^0-9]', '', 'g');
  if v_target_mbway_enabled and length(v_mbway_digits) not between 9 and 15 then
    raise exception using errcode = '22023', message = 'MBWAY_PHONE_INVALID';
  end if;

  v_whatsapp_digits := regexp_replace(coalesce(v_whatsapp_phone, ''), '[^0-9]', '', 'g');
  if v_target_mbway_enabled and length(v_whatsapp_digits) not between 9 and 15 then
    raise exception using errcode = '22023', message = 'MBWAY_WHATSAPP_PHONE_REQUIRED';
  end if;

  update public.barbershops
  set
    mbway_enabled = v_target_mbway_enabled,
    mbway_phone = v_target_mbway_phone,
    updated_at = now()
  where id = p_barbershop_id;
end;
$$;

revoke all on function public.update_barbershop_mbway_settings(uuid, boolean, text)
  from public, anon;
grant execute on function public.update_barbershop_mbway_settings(uuid, boolean, text)
  to authenticated;

create or replace function public.expire_manual_mbway_prepayments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
begin
  update public.appointments
  set
    status = 'cancelled',
    payment_status = 'expired',
    cancelled_at = now(),
    cancellation_reason = 'Pré-pagamento MB WAY não validado dentro do prazo.'
  where status = 'pending'
    and payment_status = 'awaiting_review'
    and payment_expires_at is not null
    and payment_expires_at <= now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_manual_mbway_prepayments()
  from public, anon, authenticated;
grant execute on function public.expire_manual_mbway_prepayments()
  to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'silentra-mbway-prepayment-expiry'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'silentra-mbway-prepayment-expiry',
    '*/5 * * * *',
    'select public.expire_manual_mbway_prepayments();'
  );
end;
$$;

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
set search_path = public
as $$
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
  v_closed_days text;
  v_auto_confirm boolean := false;
  v_local_dow integer;
  v_is_prepayment boolean := lower(trim(coalesce(p_status, 'scheduled'))) = 'prepayment_pending';
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
    coalesce(b.auto_confirm_bookings, false)
  into v_closed_days, v_auto_confirm
  from public.barbershops b
  where b.id = p_barbershop_id;

  if not found then
    raise exception using errcode = '22023', message = 'BOOKING_BARBERSHOP_NOT_FOUND';
  end if;

  v_local_dow := extract(dow from (p_date_hour at time zone 'Europe/Lisbon'))::integer;

  if exists (
    select 1
    from unnest(string_to_array(lower(v_closed_days), ',')) as day_value(value)
    where trim(day_value.value) = v_local_dow::text
      or trim(day_value.value) = case v_local_dow
        when 0 then 'sunday'
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        when 6 then 'saturday'
      end
      or trim(day_value.value) = case v_local_dow
        when 0 then 'domingo'
        when 1 then 'segunda'
        when 2 then 'terça'
        when 3 then 'quarta'
        when 4 then 'quinta'
        when 5 then 'sexta'
        when 6 then 'sábado'
      end
      or trim(day_value.value) = case v_local_dow
        when 0 then 'terca-feira'
        when 1 then 'segunda-feira'
        when 2 then 'terca-feira'
        when 3 then 'quarta-feira'
        when 4 then 'quinta-feira'
        when 5 then 'sexta-feira'
        when 6 then 'sabado'
      end
  ) then
    raise exception using errcode = 'P0001', message = 'BARBERSHOP_CLOSED_DAY';
  end if;

  if v_auto_confirm and lower(trim(coalesce(p_status, 'scheduled'))) <> 'prepayment_pending' then
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
$$;

revoke all on function public.create_booking_atomic(uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text) from public, anon, authenticated;
grant execute on function public.create_booking_atomic(uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text) to service_role;

comment on function public.create_booking_atomic(uuid, uuid, uuid, timestamptz, integer, text, text, text, date, text) is
  'Final atomic public booking contract with enum-safe status, Pro MB WAY prepayment hold handling, tenant-scoped conflict protection, closed-day enforcement and exact email+normalized-phone client linking.';


commit;

begin;

create table if not exists public.booking_waitlist_vacancies (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_id uuid references public.professionals(id) on delete set null,
  slot_date date not null,
  slot_time time not null,
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 1440),
  status text not null default 'pending'
    check (status in ('pending', 'dispatching', 'offered', 'completed', 'no_match', 'failed')),
  waitlist_id uuid references public.booking_waitlist(id) on delete set null,
  offer_expires_at timestamptz,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_waitlist_vacancies_queue_idx
  on public.booking_waitlist_vacancies (status, available_at, created_at);

create index if not exists booking_waitlist_vacancies_slot_idx
  on public.booking_waitlist_vacancies (
    barbershop_id,
    shop_id,
    service_id,
    slot_date,
    slot_time,
    status
  );

alter table public.booking_waitlist_vacancies enable row level security;
revoke all on table public.booking_waitlist_vacancies from public, anon, authenticated;
grant all on table public.booking_waitlist_vacancies to service_role;

comment on table public.booking_waitlist_vacancies is
  'Cancelled future appointment slots awaiting sequential customer waitlist offers. Access only through server-side workers.';

create or replace function public.enqueue_booking_waitlist_vacancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_slot_date date;
  v_slot_time time;
begin
  if new.status::text <> 'cancelled'
     or (tg_op = 'UPDATE' and old.status::text = 'cancelled')
     or new.service_id is null
     or new.date_hour <= now() then
    return new;
  end if;

  select s.id
    into v_shop_id
  from public.shops s
  where s.barbershop_id = new.barbershop_id
  order by s.created_at asc
  limit 1;

  if v_shop_id is null then
    return new;
  end if;

  v_slot_date := (new.date_hour at time zone 'Europe/Lisbon')::date;
  v_slot_time := (new.date_hour at time zone 'Europe/Lisbon')::time;

  insert into public.booking_waitlist_vacancies (
    appointment_id,
    barbershop_id,
    shop_id,
    service_id,
    professional_id,
    slot_date,
    slot_time,
    duration_minutes,
    status,
    available_at
  )
  values (
    new.id,
    new.barbershop_id,
    v_shop_id,
    new.service_id,
    new.professional_id,
    v_slot_date,
    v_slot_time,
    greatest(1, least(coalesce(new.duration_minutes, 30), 1440)),
    'pending',
    now()
  )
  on conflict (appointment_id) do update
  set barbershop_id = excluded.barbershop_id,
      shop_id = excluded.shop_id,
      service_id = excluded.service_id,
      professional_id = excluded.professional_id,
      slot_date = excluded.slot_date,
      slot_time = excluded.slot_time,
      duration_minutes = excluded.duration_minutes,
      status = 'pending',
      waitlist_id = null,
      offer_expires_at = null,
      available_at = now(),
      locked_at = null,
      sent_at = null,
      attempts = 0,
      last_error = null,
      updated_at = now()
  where public.booking_waitlist_vacancies.status in ('completed', 'no_match', 'failed');

  return new;
end;
$$;

revoke all on function public.enqueue_booking_waitlist_vacancy() from public, anon, authenticated;

drop trigger if exists appointments_enqueue_waitlist_vacancy on public.appointments;
create trigger appointments_enqueue_waitlist_vacancy
after update of status on public.appointments
for each row
when (new.status = 'cancelled')
execute function public.enqueue_booking_waitlist_vacancy();

create or replace function public.reactivate_waitlist_vacancies_for_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.booking_waitlist_vacancies v
  set status = 'pending',
      available_at = now(),
      updated_at = now(),
      last_error = null
  where v.status = 'no_match'
    and v.barbershop_id = new.barbershop_id
    and v.shop_id = new.shop_id
    and v.service_id = new.service_id
    and v.slot_date = new.preferred_date
    and new.status = 'waiting'
    and (new.professional_id is null or new.professional_id = v.professional_id)
    and (
      new.preferred_time_start is null
      or (
        v.slot_time >= new.preferred_time_start
        and v.slot_time < new.preferred_time_end
      )
    );

  return new;
end;
$$;

revoke all on function public.reactivate_waitlist_vacancies_for_new_request() from public, anon, authenticated;

drop trigger if exists booking_waitlist_reactivate_vacancies on public.booking_waitlist;
create trigger booking_waitlist_reactivate_vacancies
after insert on public.booking_waitlist
for each row execute function public.reactivate_waitlist_vacancies_for_new_request();

create or replace function public.sync_booking_waitlist_vacancies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vacancy record;
  v_local_date date;
  v_local_time time;
begin
  if new.status::text not in ('pending', 'scheduled') then
    return new;
  end if;

  v_local_date := (new.date_hour at time zone 'Europe/Lisbon')::date;
  v_local_time := (new.date_hour at time zone 'Europe/Lisbon')::time;

  for v_vacancy in
    select v.*
    from public.booking_waitlist_vacancies v
    where v.barbershop_id = new.barbershop_id
      and v.status in ('pending', 'dispatching', 'offered')
      and v.slot_date = v_local_date
      and (
        v.professional_id is null
        or new.professional_id is null
        or v.professional_id = new.professional_id
      )
      and (new.date_hour < ((v.slot_date::text || ' ' || v.slot_time::text)::timestamp at time zone 'Europe/Lisbon') + make_interval(mins => v.duration_minutes))
      and (new.date_hour + make_interval(mins => greatest(1, least(coalesce(new.duration_minutes, 30), 1440))) > ((v.slot_date::text || ' ' || v.slot_time::text)::timestamp at time zone 'Europe/Lisbon'))
    for update
  loop
    if v_vacancy.waitlist_id is not null then
      if v_local_time = v_vacancy.slot_time
         and new.service_id = v_vacancy.service_id
         and lower(coalesce(new.manual_email, '')) = (
           select lower(w.customer_email)
           from public.booking_waitlist w
           where w.id = v_vacancy.waitlist_id
         ) then
        update public.booking_waitlist
        set status = 'booked',
            linked_appointment_id = new.id,
            offer_expires_at = null,
            updated_at = now()
        where id = v_vacancy.waitlist_id
          and status = 'offered';
      else
        update public.booking_waitlist
        set status = 'waiting',
            offered_date = null,
            offered_time = null,
            offer_expires_at = null,
            updated_at = now()
        where id = v_vacancy.waitlist_id
          and status = 'offered';
      end if;
    end if;

    update public.booking_waitlist_vacancies
    set status = 'completed',
        offer_expires_at = null,
        locked_at = null,
        updated_at = now(),
        last_error = null
    where id = v_vacancy.id;
  end loop;

  return new;
end;
$$;

revoke all on function public.sync_booking_waitlist_vacancies() from public, anon, authenticated;

drop trigger if exists appointments_sync_booking_waitlist_vacancies on public.appointments;
create trigger appointments_sync_booking_waitlist_vacancies
after insert or update of status, date_hour, duration_minutes, professional_id, service_id, manual_email
on public.appointments
for each row
when (new.status in ('pending', 'scheduled'))
execute function public.sync_booking_waitlist_vacancies();

create or replace function public.recover_stale_booking_waitlist_offers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_expired integer := 0;
  v_recovered integer := 0;
begin
  update public.booking_waitlist w
  set status = 'expired',
      updated_at = now()
  from public.booking_waitlist_vacancies v
  where v.waitlist_id = w.id
    and v.status = 'offered'
    and v.offer_expires_at <= now()
    and w.status = 'offered';
  get diagnostics v_expired = row_count;

  update public.booking_waitlist_vacancies
  set status = 'pending',
      waitlist_id = null,
      offer_expires_at = null,
      locked_at = null,
      available_at = now(),
      last_error = 'Previous offer expired',
      updated_at = now()
  where status = 'offered'
    and offer_expires_at <= now();

  -- If a worker lost its connection after sending the email, preserve the
  -- existing offer rather than sending the same invitation twice.
  update public.booking_waitlist_vacancies
  set status = case
        when offer_expires_at > now() then 'offered'
        else 'pending'
      end,
      locked_at = null,
      sent_at = coalesce(sent_at, now()),
      available_at = case
        when offer_expires_at > now() then available_at
        else now()
      end,
      last_error = 'Delivery outcome recovered after worker interruption',
      updated_at = now()
  where status = 'dispatching'
    and locked_at < now() - interval '10 minutes';
  get diagnostics v_recovered = row_count;

  v_count := v_expired + v_recovered;
  return v_count;
end;
$$;

revoke all on function public.recover_stale_booking_waitlist_offers() from public, anon, authenticated;
grant execute on function public.recover_stale_booking_waitlist_offers() to service_role;

create or replace function public.claim_booking_waitlist_vacancies(p_batch_size integer default 25)
returns table (
  vacancy_id uuid,
  waitlist_id uuid,
  shop_id uuid,
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
set search_path = public
as $$
declare
  v_vacancy record;
  v_waitlist_id uuid;
  v_expiry timestamptz;
begin
  perform public.recover_stale_booking_waitlist_offers();

  for v_vacancy in
    select v.*
    from public.booking_waitlist_vacancies v
    where v.status = 'pending'
      and v.available_at <= now()
      and v.attempts < 5
    order by v.created_at asc, v.id asc
    limit greatest(1, least(coalesce(p_batch_size, 25), 100))
    for update skip locked
  loop
    if exists (
      select 1
      from public.booking_waitlist_vacancies other
      where other.id <> v_vacancy.id
        and other.barbershop_id = v_vacancy.barbershop_id
        and other.shop_id = v_vacancy.shop_id
        and other.service_id = v_vacancy.service_id
        and other.slot_date = v_vacancy.slot_date
        and other.slot_time = v_vacancy.slot_time
        and other.professional_id is not distinct from v_vacancy.professional_id
        and other.status in ('dispatching', 'offered')
        and coalesce(other.offer_expires_at, now() + interval '1 minute') > now()
    ) then
      update public.booking_waitlist_vacancies
      set status = 'no_match',
          updated_at = now(),
          last_error = 'Another active offer already covers this slot'
      where id = v_vacancy.id;
      continue;
    end if;

    if exists (
      select 1
      from public.appointments a
      where a.barbershop_id = v_vacancy.barbershop_id
        and a.id <> v_vacancy.appointment_id
        and a.status::text in ('pending', 'scheduled')
        and a.date_hour < ((v_vacancy.slot_date::text || ' ' || v_vacancy.slot_time::text)::timestamp at time zone 'Europe/Lisbon') + make_interval(mins => v_vacancy.duration_minutes)
        and a.date_hour + make_interval(mins => greatest(1, least(coalesce(a.duration_minutes, 30), 1440))) > ((v_vacancy.slot_date::text || ' ' || v_vacancy.slot_time::text)::timestamp at time zone 'Europe/Lisbon')
        and (
          v_vacancy.professional_id is null
          or a.professional_id is null
          or a.professional_id = v_vacancy.professional_id
        )
    ) or exists (
      select 1
      from public.schedule_blocks b
      where b.barbershop_id = v_vacancy.barbershop_id
        and b.date = v_vacancy.slot_date
        and (b.professional_id is null or b.professional_id = v_vacancy.professional_id)
        and (
          b.start_time is null
          or b.end_time is null
          or (
            v_vacancy.slot_time < b.end_time
            and v_vacancy.slot_time + make_interval(mins => v_vacancy.duration_minutes) > b.start_time
          )
        )
    ) then
      update public.booking_waitlist_vacancies
      set status = 'completed',
          updated_at = now(),
          last_error = 'Slot is no longer available'
      where id = v_vacancy.id;
      continue;
    end if;

    select w.id
      into v_waitlist_id
    from public.booking_waitlist w
    join public.services s
      on s.id = w.service_id
     and s.barbershop_id = w.barbershop_id
     and s.is_active = true
    left join public.professionals p
      on p.id = w.professional_id
     and p.barbershop_id = w.barbershop_id
     and p.active = true
    where w.barbershop_id = v_vacancy.barbershop_id
      and w.shop_id = v_vacancy.shop_id
      and w.service_id = v_vacancy.service_id
      and w.preferred_date = v_vacancy.slot_date
      and w.status = 'waiting'
      and (w.professional_id is null or w.professional_id = v_vacancy.professional_id)
      and (w.professional_id is null or p.id is not null)
      and (
        w.preferred_time_start is null
        or (
          v_vacancy.slot_time >= w.preferred_time_start
          and v_vacancy.slot_time < w.preferred_time_end
        )
      )
    order by w.created_at asc, w.id asc
    limit 1
    for update of w skip locked;

    if v_waitlist_id is null then
      update public.booking_waitlist_vacancies
      set status = 'no_match',
          updated_at = now(),
          last_error = null
      where id = v_vacancy.id;
      continue;
    end if;

    v_expiry := now() + interval '20 minutes';

    update public.booking_waitlist
    set status = 'offered',
        offered_date = v_vacancy.slot_date,
        offered_time = v_vacancy.slot_time,
        offer_expires_at = v_expiry,
        last_contacted_at = now(),
        updated_at = now()
    where id = v_waitlist_id
      and status = 'waiting';

    update public.booking_waitlist_vacancies
    set status = 'dispatching',
        waitlist_id = v_waitlist_id,
        offer_expires_at = v_expiry,
        locked_at = now(),
        attempts = attempts + 1,
        updated_at = now(),
        last_error = null
    where id = v_vacancy.id;

    return query
    select
      v_vacancy.id,
      w.id,
      w.shop_id,
      w.barbershop_id,
      w.offered_date,
      w.offered_time,
      w.offer_expires_at,
      w.customer_name,
      w.customer_email,
      w.customer_phone,
      s.name,
      p.name,
      sh.name,
      coalesce(b.default_language, 'pt'),
      v_vacancy.attempts + 1
    from public.booking_waitlist w
    join public.services s on s.id = w.service_id
    left join public.professionals p on p.id = w.professional_id
    join public.shops sh on sh.id = w.shop_id
    join public.barbershops b on b.id = w.barbershop_id
    where w.id = v_waitlist_id;
  end loop;
end;
$$;

revoke all on function public.claim_booking_waitlist_vacancies(integer) from public, anon, authenticated;
grant execute on function public.claim_booking_waitlist_vacancies(integer) to service_role;

create or replace function public.release_booking_waitlist_offer(
  p_vacancy_id uuid,
  p_waitlist_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  select attempts
    into v_attempts
  from public.booking_waitlist_vacancies
  where id = p_vacancy_id
    and waitlist_id = p_waitlist_id
    and status = 'dispatching'
  for update;

  if not found then
    return false;
  end if;

  update public.booking_waitlist
  set status = 'waiting',
      offered_date = null,
      offered_time = null,
      offer_expires_at = null,
      updated_at = now()
  where id = p_waitlist_id
    and status = 'offered';

  update public.booking_waitlist_vacancies
  set status = case when v_attempts >= 5 then 'failed' else 'pending' end,
      waitlist_id = null,
      offer_expires_at = null,
      locked_at = null,
      available_at = now() + make_interval(mins => case when v_attempts >= 5 then 0 else least(30, 2 ^ v_attempts) end),
      last_error = left(coalesce(p_error, 'Email could not be sent'), 500),
      updated_at = now()
  where id = p_vacancy_id
    and status = 'dispatching';

  return true;
end;
$$;

revoke all on function public.release_booking_waitlist_offer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_booking_waitlist_offer(uuid, uuid, text) to service_role;

create or replace function public.complete_booking_waitlist_offer_delivery(
  p_vacancy_id uuid,
  p_waitlist_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.booking_waitlist_vacancies
  set status = 'offered',
      sent_at = now(),
      locked_at = null,
      last_error = null,
      updated_at = now()
  where id = p_vacancy_id
    and waitlist_id = p_waitlist_id
    and status = 'dispatching'
    and offer_expires_at > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.complete_booking_waitlist_offer_delivery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_booking_waitlist_offer_delivery(uuid, uuid) to service_role;

create extension if not exists pg_net;

select cron.schedule(
  'silentra-booking-waitlist-offers',
  '*/2 * * * *',
  $job$
    with signing as (
      select
        floor(extract(epoch from clock_timestamp()))::bigint::text as ts,
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'silentra_booking_outbox_cron_secret'
         limit 1) as secret,
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'silentra_booking_outbox_url'
         limit 1) as endpoint
    )
    select net.http_post(
      url := regexp_replace(signing.endpoint, '/api/cron/booking-automation-outbox/?$', '/api/cron/booking-waitlist-offers'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-waitlist-timestamp', signing.ts,
        'x-waitlist-signature', encode(
          extensions.hmac(signing.ts || ':booking-waitlist-offers', signing.secret, 'sha256'),
          'hex'
        )
      ),
      body := jsonb_build_object('source', 'supabase-cron'),
      timeout_milliseconds := 20000
    )
    from signing
    where signing.secret is not null and signing.endpoint is not null;
  $job$
);

commit;
